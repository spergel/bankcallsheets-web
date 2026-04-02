#!/usr/bin/env node
/**
 * Pulls full historical financial statements from SEC EDGAR XBRL for each BHC.
 * Extracts income statement + balance sheet from all available 10-K annual filings.
 * Stores one row per (bhc_cik, period_end) in bhc_financials table.
 *
 * Complements FFIEC call report data (bank-level) with consolidated holding
 * company financials (investor-facing).
 *
 * Run after link-tickers.js, and after each 10-K season (Feb/March):
 *   node scripts/sync-xbrl.js
 *
 * Units: XBRL values are actual dollars. We store in $000s (divide by 1000)
 * to match the convention used by our FFIEC call report data.
 */

require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const SEC_BASE   = 'https://data.sec.gov';
const USER_AGENT = 'BankData/1.0 contact@bankcallsheets.com';

function getUrl() {
  return (process.env.DATABASE_URL ?? '').replace('-pooler', '');
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.json();
}

/**
 * Get all annual (10-K, FY) values for a duration concept (income statement).
 * Returns array of { end, val } sorted newest-first, deduped by period end.
 */
function allAnnualFacts(facts, taxonomy, ...concepts) {
  for (const concept of concepts) {
    const data = facts?.[taxonomy]?.[concept]?.units?.USD;
    if (!Array.isArray(data) || data.length === 0) continue;
    const annual = data.filter(e => e.form === '10-K' && (e.fp === 'FY' || !e.fp));
    if (annual.length === 0) continue;
    // Dedup by end date: keep highest val (avoids restatement duplicates)
    const byEnd = new Map();
    for (const e of annual) {
      if (!byEnd.has(e.end) || Math.abs(e.val) > Math.abs(byEnd.get(e.end))) {
        byEnd.set(e.end, e.val);
      }
    }
    return [...byEnd.entries()]
      .map(([end, val]) => ({ end, val }))
      .sort((a, b) => b.end.localeCompare(a.end));
  }
  return [];
}

/**
 * Get all annual (10-K) instantaneous (balance sheet) values.
 * Balance sheet items have an 'end' date but no 'start' date, OR
 * they appear as instant items from 10-K filings.
 */
function allAnnualInstants(facts, taxonomy, ...concepts) {
  for (const concept of concepts) {
    const data = facts?.[taxonomy]?.[concept]?.units?.USD;
    if (!Array.isArray(data) || data.length === 0) continue;
    // Keep 10-K items (which report balance sheet as of year end)
    const annual = data.filter(e => e.form === '10-K');
    if (annual.length === 0) continue;
    const byEnd = new Map();
    for (const e of annual) {
      if (!byEnd.has(e.end) || e.val > (byEnd.get(e.end) ?? -Infinity)) {
        byEnd.set(e.end, e.val);
      }
    }
    return [...byEnd.entries()]
      .map(([end, val]) => ({ end, val }))
      .sort((a, b) => b.end.localeCompare(a.end));
  }
  return [];
}

/** Build a map of period_end → value from an allAnnual* result. */
function toMap(arr) {
  return new Map(arr.map(e => [e.end, e.val]));
}

/** Round to $000s, or null if value is null/undefined. */
function k(val) {
  return val != null ? Math.round(val / 1000) : null;
}

function processCompany(facts) {
  // --- Income statement (duration concepts, FY annual) ---

  // Total interest income (gross, before subtracting interest expense)
  const interestIncomeArr = allAnnualFacts(facts, 'us-gaap',
    'InterestIncomeOperating',               // JPM, large banks (post-2015)
    'InterestAndDividendIncomeOperating',     // older/smaller banks
    'InterestAndFeeIncomeLoansAndLeases',     // sometimes used by smaller banks
  );

  // Interest expense
  const interestExpenseArr = allAnnualFacts(facts, 'us-gaap',
    'InterestExpenseOperating',
    'InterestExpense',
  );

  // Net interest income — try direct tag first, compute as fallback in assembly
  const netInterestIncomeArr = allAnnualFacts(facts, 'us-gaap',
    'InterestIncomeExpenseNet',
    'InterestIncomeExpenseAfterProvisionForLoanLoss', // NII after provision — less ideal
  );

  // Non-interest income (fees, trading, etc.)
  const noninterestIncomeArr = allAnnualFacts(facts, 'us-gaap',
    'NoninterestIncome',
    'RevenueFromContractWithCustomerExcludingAssessedTax', // fallback
  );

  // Non-interest expense (salaries, overhead)
  const noninterestExpenseArr = allAnnualFacts(facts, 'us-gaap',
    'NoninterestExpense',
  );

  // Provision for credit losses (CECL post-2020) / loan loss provision (older)
  const provisionArr = allAnnualFacts(facts, 'us-gaap',
    'ProvisionForCreditLosses',                        // ASC 326 (CECL, post-2020)
    'ProvisionForLoanAndLeaseLosses',                  // older standard
    'ProvisionForLoanLeaseAndOtherLosses',
  );

  // Net income
  const netIncomeArr = allAnnualFacts(facts, 'us-gaap',
    'NetIncomeLoss',
    'NetIncomeLossAvailableToCommonStockholdersBasic',
  );

  // EPS diluted (USD/shares unit)
  const epsArr = allAnnualFacts(facts, 'us-gaap',
    'EarningsPerShareDiluted',
    'EarningsPerShareBasic',
  );
  // EPS uses different unit
  for (const c of ['EarningsPerShareDiluted', 'EarningsPerShareBasic']) {
    const data = facts?.['us-gaap']?.[c]?.units?.['USD/shares'];
    if (!data?.length) continue;
    const annual = data.filter(e => e.form === '10-K' && (e.fp === 'FY' || !e.fp));
    if (annual.length > 0) {
      const byEnd = new Map();
      for (const e of annual) {
        if (!byEnd.has(e.end)) byEnd.set(e.end, e.val);
      }
      epsArr.length = 0;
      [...byEnd.entries()]
        .sort((a, b) => b[0].localeCompare(a[0]))
        .forEach(([end, val]) => epsArr.push({ end, val }));
      break;
    }
  }

  // --- Balance sheet (instantaneous, as-of year end) ---

  const assetsArr       = allAnnualInstants(facts, 'us-gaap', 'Assets');
  const depositsArr     = allAnnualInstants(facts, 'us-gaap',
    'Deposits',
    'DepositLiabilities',
  );
  const equityArr       = allAnnualInstants(facts, 'us-gaap',
    'StockholdersEquity',
    'StockholdersEquityAttributableToParent',
  );
  const goodwillArr     = allAnnualInstants(facts, 'us-gaap', 'Goodwill');
  const intangiblesArr  = allAnnualInstants(facts, 'us-gaap',
    'IntangibleAssetsNetExcludingGoodwill',
    'FiniteLivedIntangibleAssetsNet',
  );
  const loansArr        = allAnnualInstants(facts, 'us-gaap',
    'FinancingReceivableExcludingAccruedInterestAfterAllowanceForCreditLoss', // post-2020
    'LoansAndLeasesReceivableNetReportedAmount',   // pre-2020
    'LoansAndLeasesReceivableNetOfDeferredIncome',
  );
  const sharesArr = (() => {
    for (const c of ['EntityCommonStockSharesOutstanding', 'CommonStockSharesOutstanding']) {
      for (const tax of ['dei', 'us-gaap']) {
        const data = facts?.[tax]?.[c]?.units?.shares;
        if (!data?.length) continue;
        const annual = data.filter(e => e.form === '10-K');
        if (!annual.length) continue;
        const byEnd = new Map();
        for (const e of annual) {
          if (!byEnd.has(e.end)) byEnd.set(e.end, e.val);
        }
        return [...byEnd.entries()]
          .map(([end, val]) => ({ end, val }))
          .sort((a, b) => b.end.localeCompare(a.end));
      }
    }
    return [];
  })();

  // --- Assemble into per-period rows ---

  // Use Assets periods as the master list of annual report dates
  const periods = assetsArr.map(e => e.end);
  if (periods.length === 0) return [];

  const maps = {
    interestIncome:    toMap(interestIncomeArr),
    interestExpense:   toMap(interestExpenseArr),
    netInterestIncome: toMap(netInterestIncomeArr),
    noninterestIncome: toMap(noninterestIncomeArr),
    noninterestExpense:toMap(noninterestExpenseArr),
    provision:         toMap(provisionArr),
    netIncome:         toMap(netIncomeArr),
    eps:               toMap(epsArr),
    assets:            toMap(assetsArr),
    deposits:          toMap(depositsArr),
    equity:            toMap(equityArr),
    goodwill:          toMap(goodwillArr),
    intangibles:       toMap(intangiblesArr),
    loans:             toMap(loansArr),
    shares:            toMap(sharesArr),
  };

  return periods.map(end => {
    const ii    = maps.interestIncome.get(end)    ?? null;
    const ie    = maps.interestExpense.get(end)   ?? null;
    const niiDirect = maps.netInterestIncome.get(end) ?? null;
    const nii   = niiDirect ?? (ii != null && ie != null ? ii - ie : null);
    const eq    = maps.equity.get(end)            ?? null;
    const gw    = maps.goodwill.get(end)          ?? 0;
    const inta  = maps.intangibles.get(end)       ?? 0;
    const sh    = maps.shares.get(end)            ?? null;
    const tbv   = eq != null && sh != null && sh > 0
                  ? (eq - gw - inta) / sh
                  : null;

    return {
      period_end:          end,
      interest_income:     k(ii),
      interest_expense:    k(ie),
      net_interest_income: k(nii),
      noninterest_income:  k(maps.noninterestIncome.get(end)  ?? null),
      noninterest_expense: k(maps.noninterestExpense.get(end) ?? null),
      provision:           k(maps.provision.get(end)           ?? null),
      net_income:          k(maps.netIncome.get(end)           ?? null),
      eps_diluted:         maps.eps.get(end)                   ?? null,
      total_assets:        k(maps.assets.get(end)              ?? null),
      total_deposits:      k(maps.deposits.get(end)            ?? null),
      total_equity:        k(eq),
      goodwill:            k(gw || null),
      net_loans:           k(maps.loans.get(end)               ?? null),
      shares_out:          sh != null ? Math.round(sh) : null,
      tbv_per_share:       tbv,
    };
  });
}

async function main() {
  const client = new Client({ connectionString: getUrl() });
  await client.connect();
  console.log('Connected.');

  // Create bhc_financials table
  await client.query(`
    CREATE TABLE IF NOT EXISTS bhc_financials (
      bhc_cik             TEXT        NOT NULL,
      period_end          DATE        NOT NULL,
      interest_income     BIGINT,
      interest_expense    BIGINT,
      net_interest_income BIGINT,
      noninterest_income  BIGINT,
      noninterest_expense BIGINT,
      provision           BIGINT,
      net_income          BIGINT,
      eps_diluted         FLOAT,
      total_assets        BIGINT,
      total_deposits      BIGINT,
      total_equity        BIGINT,
      goodwill            BIGINT,
      net_loans           BIGINT,
      shares_out          BIGINT,
      tbv_per_share       FLOAT,
      PRIMARY KEY (bhc_cik, period_end)
    )
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_bhcfin_cik    ON bhc_financials(bhc_cik)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_bhcfin_period ON bhc_financials(period_end)`);
  console.log('Table ready.');

  // Get all distinct CIKs
  const { rows } = await client.query(`
    SELECT DISTINCT bhc_cik, MAX(bhc_ticker) AS ticker
    FROM institutions
    WHERE bhc_cik IS NOT NULL
    GROUP BY bhc_cik
    ORDER BY bhc_cik
  `);
  console.log(`Processing ${rows.length} distinct BHC CIKs…`);

  let ok = 0, failed = 0, rowsInserted = 0;
  for (let i = 0; i < rows.length; i++) {
    const { bhc_cik, ticker } = rows[i];
    try {
      const padded = String(bhc_cik).padStart(10, '0');
      const json   = await fetchJson(`${SEC_BASE}/api/xbrl/companyfacts/CIK${padded}.json`);
      const facts  = json.facts ?? {};
      const periods = processCompany(facts);

      for (const p of periods) {
        await client.query(`
          INSERT INTO bhc_financials (
            bhc_cik, period_end,
            interest_income, interest_expense, net_interest_income,
            noninterest_income, noninterest_expense, provision,
            net_income, eps_diluted,
            total_assets, total_deposits, total_equity, goodwill, net_loans,
            shares_out, tbv_per_share
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
          ON CONFLICT (bhc_cik, period_end) DO UPDATE SET
            interest_income     = EXCLUDED.interest_income,
            interest_expense    = EXCLUDED.interest_expense,
            net_interest_income = EXCLUDED.net_interest_income,
            noninterest_income  = EXCLUDED.noninterest_income,
            noninterest_expense = EXCLUDED.noninterest_expense,
            provision           = EXCLUDED.provision,
            net_income          = EXCLUDED.net_income,
            eps_diluted         = EXCLUDED.eps_diluted,
            total_assets        = EXCLUDED.total_assets,
            total_deposits      = EXCLUDED.total_deposits,
            total_equity        = EXCLUDED.total_equity,
            goodwill            = EXCLUDED.goodwill,
            net_loans           = EXCLUDED.net_loans,
            shares_out          = EXCLUDED.shares_out,
            tbv_per_share       = EXCLUDED.tbv_per_share
        `, [
          bhc_cik, p.period_end,
          p.interest_income, p.interest_expense, p.net_interest_income,
          p.noninterest_income, p.noninterest_expense, p.provision,
          p.net_income, p.eps_diluted,
          p.total_assets, p.total_deposits, p.total_equity, p.goodwill, p.net_loans,
          p.shares_out, p.tbv_per_share,
        ]);
        rowsInserted++;
      }
      ok++;
    } catch (e) {
      failed++;
    }

    await sleep(220); // ~4.5 req/sec — within SEC guidelines

    if ((i + 1) % 25 === 0 || i === rows.length - 1) {
      process.stdout.write(`  ${i + 1}/${rows.length} CIKs (ok:${ok} failed:${failed} rows:${rowsInserted})\r`);
    }
  }

  console.log(`\nDone. ${ok} companies, ${rowsInserted.toLocaleString()} annual periods inserted.`);

  // Sanity check: show sample of largest banks with recent data
  const { rows: sample } = await client.query(`
    SELECT f.bhc_cik, MAX(i.bhc_ticker) AS ticker,
           MAX(f.total_assets) FILTER (WHERE f.period_end = (
             SELECT MAX(f2.period_end) FROM bhc_financials f2 WHERE f2.bhc_cik = f.bhc_cik
           )) AS latest_assets,
           COUNT(*) AS periods
    FROM bhc_financials f
    JOIN institutions i USING (bhc_cik)
    GROUP BY f.bhc_cik
    ORDER BY latest_assets DESC NULLS LAST
    LIMIT 15
  `);
  console.log('\nLargest BHCs by total assets (latest period):');
  for (const r of sample) {
    const assets = r.latest_assets ? `$${(Number(r.latest_assets)/1e7).toFixed(1)}B` : '—';
    console.log(`  ${(r.ticker ?? '—').padEnd(6)}  ${assets.padStart(10)}  ${r.periods} annual periods`);
  }

  await client.end();
}

main().catch(e => {
  console.error('sync-xbrl failed:', e.message);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Pulls XBRL company facts from SEC EDGAR for each bank with a known CIK.
 * Extracts: shares outstanding, diluted EPS, dividends/share, goodwill,
 * intangibles, stockholders equity → computes TBV/share.
 *
 * Run after link-tickers.js, and after each 10-K season (Feb/March):
 *   node scripts/sync-edgar.js
 *
 * Note: EDGAR values are in actual dollars (not thousands). We convert
 * per-share metrics to actual dollars and store them directly.
 * market_cap is converted to $000s to match our DB convention.
 */

require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const SEC_BASE   = 'https://data.sec.gov';
const USER_AGENT = 'BankData Research tool/1.0 (non-commercial; github.com/spergel/bankcallsheets-web)';

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
 * Get the most recent value for a XBRL concept from company facts.
 * Prefers 10-K annual filings, then 10-Q.
 * For instantaneous (balance sheet) concepts: just latest end date.
 * For duration (income) concepts: prefer FY (full year) fp.
 */
function latestFact(facts, taxonomy, concept, unit = 'USD') {
  const data = facts?.[taxonomy]?.[concept]?.units?.[unit];
  if (!Array.isArray(data) || data.length === 0) return null;

  // For duration metrics (EPS, dividends), prefer most recent FY 10-K
  const annual = data
    .filter(e => e.form === '10-K' && (e.fp === 'FY' || !e.fp))
    .sort((a, b) => b.end.localeCompare(a.end));
  if (annual.length > 0) return annual[0].val;

  // Fallback: any filing, most recent end date
  const sorted = [...data].sort((a, b) => b.end.localeCompare(a.end));
  return sorted[0]?.val ?? null;
}

/**
 * Get the most recent instantaneous (balance sheet) value.
 * These have an 'end' date but no 'start'.
 */
function latestInstant(facts, taxonomy, concept, unit = 'USD') {
  const data = facts?.[taxonomy]?.[concept]?.units?.[unit];
  if (!Array.isArray(data) || data.length === 0) return null;
  // Instantaneous facts don't have a start date
  const instants = data.filter(e => !e.start);
  if (instants.length > 0) {
    return [...instants].sort((a, b) => b.end.localeCompare(a.end))[0]?.val ?? null;
  }
  // Fallback: any, most recent end
  return [...data].sort((a, b) => b.end.localeCompare(a.end))[0]?.val ?? null;
}

async function processCompany(cik) {
  const padded = String(cik).padStart(10, '0');
  const json   = await fetchJson(`${SEC_BASE}/api/xbrl/companyfacts/CIK${padded}.json`);
  const facts  = json.facts ?? {};

  // Shares outstanding — try DEI first (cover page, most current), then us-gaap
  const shares =
    latestInstant(facts, 'dei',     'EntityCommonStockSharesOutstanding', 'shares') ??
    latestInstant(facts, 'us-gaap', 'CommonStockSharesOutstanding',       'shares') ??
    latestInstant(facts, 'us-gaap', 'CommonStockSharesIssued',            'shares');

  // Diluted EPS — annual
  const epsDiluted =
    latestFact(facts, 'us-gaap', 'EarningsPerShareDiluted', 'USD/shares') ??
    latestFact(facts, 'us-gaap', 'EarningsPerShareBasic',   'USD/shares');

  // Dividends per share — annual declared or paid
  const divPerShare =
    latestFact(facts, 'us-gaap', 'CommonStockDividendsPerShareDeclared',       'USD/shares') ??
    latestFact(facts, 'us-gaap', 'CommonStockDividendsPerShareCashPaid',       'USD/shares') ??
    latestFact(facts, 'us-gaap', 'DividendsCommonStockCashPaidPerShare',       'USD/shares');

  // Balance sheet for TBV calculation
  const equity      = latestInstant(facts, 'us-gaap', 'StockholdersEquity');
  const goodwill    = latestInstant(facts, 'us-gaap', 'Goodwill') ?? 0;
  const intangibles = latestInstant(facts, 'us-gaap', 'IntangibleAssetsNetExcludingGoodwill') ?? 0;

  // TBV per share (in actual dollars)
  let tbvPerShare = null;
  if (equity != null && shares != null && shares > 0) {
    const tbv = equity - goodwill - intangibles;
    tbvPerShare = tbv / shares;
  }

  return {
    shares_out:   shares    != null ? Math.round(shares) : null,
    eps_diluted:  epsDiluted,
    div_per_share: divPerShare,
    tbv_per_share: tbvPerShare,
  };
}

async function main() {
  const client = new Client({ connectionString: getUrl() });
  await client.connect();
  console.log('Connected.');

  // Add columns idempotently
  for (const col of [
    'shares_out BIGINT',
    'eps_diluted FLOAT',
    'div_per_share FLOAT',
    'tbv_per_share FLOAT',
  ]) {
    await client.query(`ALTER TABLE institutions ADD COLUMN IF NOT EXISTS ${col}`);
  }

  // Get all distinct CIKs that we need to process
  const { rows } = await client.query(`
    SELECT DISTINCT bhc_cik, array_agg(idrssd) AS idrssd_list
    FROM institutions
    WHERE bhc_cik IS NOT NULL
    GROUP BY bhc_cik
    ORDER BY bhc_cik
  `);
  console.log(`Processing ${rows.length.toLocaleString()} distinct BHC CIKs…`);

  let ok = 0, failed = 0;
  for (let i = 0; i < rows.length; i++) {
    const { bhc_cik, idrssd_list } = rows[i];
    try {
      const data = await processCompany(bhc_cik);
      const idrssdArr = idrssd_list; // postgres array

      await client.query(
        `UPDATE institutions SET
           shares_out    = $1,
           eps_diluted   = $2,
           div_per_share = $3,
           tbv_per_share = $4
         WHERE idrssd = ANY($5)`,
        [data.shares_out, data.eps_diluted, data.div_per_share, data.tbv_per_share, idrssdArr],
      );
      ok++;
    } catch (e) {
      failed++;
      // Continue on error — one company shouldn't stop the whole run
    }

    // Respect SEC rate limit: ~5 req/sec
    await sleep(220);

    if ((i + 1) % 25 === 0 || i === rows.length - 1) {
      process.stdout.write(`  ${i + 1}/${rows.length} CIKs (ok:${ok} failed:${failed})\r`);
    }
  }

  console.log(`\nDone. ${ok} CIKs updated, ${failed} failed.`);

  // Quick sanity check
  const { rows: sample } = await client.query(`
    SELECT name, bhc_ticker, eps_diluted, div_per_share, tbv_per_share, shares_out
    FROM institutions
    WHERE tbv_per_share IS NOT NULL
    ORDER BY total_assets DESC NULLS LAST
    LIMIT 10
  `);
  console.log('\nSample (largest banks with TBV data):');
  for (const r of sample) {
    const tbv = r.tbv_per_share ? `TBV $${Number(r.tbv_per_share).toFixed(2)}` : '';
    const eps = r.eps_diluted   ? `EPS $${Number(r.eps_diluted).toFixed(2)}`   : '';
    const div = r.div_per_share ? `Div $${Number(r.div_per_share).toFixed(2)}` : '';
    console.log(`  ${(r.bhc_ticker ?? '—').padEnd(6)} ${r.name.slice(0, 40).padEnd(40)} ${tbv} ${eps} ${div}`);
  }

  await client.end();
}

main().catch(e => {
  console.error('sync-edgar failed:', e.message);
  process.exit(1);
});

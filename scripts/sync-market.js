#!/usr/bin/env node
/**
 * Fetches market data from Yahoo Finance for each bank with a known ticker.
 * Pulls: stock price, market cap, P/E, P/B, dividend yield.
 *
 * Run weekly (or whenever you want fresh prices):
 *   node scripts/sync-market.js
 *
 * market_cap is stored in $000s to match our DB unit convention.
 * stock_price and ratios are stored in their natural units.
 *
 * Yahoo Finance is unofficial — no API key needed but may occasionally
 * require header adjustments if Yahoo changes their API.
 */

require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

// Yahoo Finance v8 chart endpoint — returns price without auth
const YF_CHART   = 'https://query2.finance.yahoo.com/v8/finance/chart';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function getUrl() {
  return (process.env.DATABASE_URL ?? '').replace('-pooler', '');
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchPrice(ticker) {
  const url = `${YF_CHART}/${ticker}?interval=1d&range=1d`;
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${ticker}`);
  const json = await res.json();
  if (json?.chart?.error) throw new Error(`Yahoo error for ${ticker}: ${json.chart.error}`);
  const price = json?.chart?.result?.[0]?.meta?.regularMarketPrice;
  if (price == null) throw new Error(`no price for ${ticker}`);
  return Number(price);
}

async function main() {
  const client = new Client({ connectionString: getUrl() });
  await client.connect();
  console.log('Connected.');

  // Add columns idempotently
  for (const col of [
    'market_cap BIGINT',
    'stock_price FLOAT',
    'pe_ratio FLOAT',
    'pb_ratio FLOAT',
    'div_yield FLOAT',
  ]) {
    await client.query(`ALTER TABLE institutions ADD COLUMN IF NOT EXISTS ${col}`);
  }
  await client.query(`CREATE INDEX IF NOT EXISTS idx_inst_mktcap ON institutions(market_cap DESC NULLS LAST)`);

  // Get distinct tickers with EDGAR data for ratio computation
  const { rows } = await client.query(`
    SELECT DISTINCT bhc_ticker,
      array_agg(idrssd)          AS idrssd_list,
      MAX(shares_out)            AS shares_out,
      MAX(eps_diluted)           AS eps_diluted,
      MAX(tbv_per_share)         AS tbv_per_share,
      MAX(div_per_share)         AS div_per_share
    FROM institutions
    WHERE bhc_ticker IS NOT NULL
    GROUP BY bhc_ticker
    ORDER BY bhc_ticker
  `);
  console.log(`Fetching market data for ${rows.length.toLocaleString()} tickers…`);

  let ok = 0, failed = 0;
  const failures = [];

  for (let i = 0; i < rows.length; i++) {
    const { bhc_ticker, idrssd_list, shares_out, eps_diluted, tbv_per_share, div_per_share } = rows[i];
    try {
      const price = await fetchPrice(bhc_ticker);

      // Compute ratios from EDGAR data
      const sharesN  = shares_out    != null ? Number(shares_out)    : null;
      const epsN     = eps_diluted   != null ? Number(eps_diluted)   : null;
      const tbvN     = tbv_per_share != null ? Number(tbv_per_share) : null;
      const divN     = div_per_share != null ? Number(div_per_share) : null;

      const marketCap = sharesN ? Math.round(sharesN * price / 1000) : null; // → $000s
      const peRatio   = epsN  && epsN  > 0 ? price / epsN  : null;
      const pbRatio   = tbvN  && tbvN  > 0 ? price / tbvN  : null;
      const divYield  = divN  && price > 0  ? divN  / price : null;

      await client.query(
        `UPDATE institutions SET
           stock_price = $1,
           market_cap  = $2,
           pe_ratio    = $3,
           pb_ratio    = $4,
           div_yield   = $5
         WHERE idrssd = ANY($6)`,
        [price, marketCap, peRatio, pbRatio, divYield, idrssd_list],
      );
      ok++;
    } catch (e) {
      failed++;
      failures.push(`${bhc_ticker}: ${e.message}`);
    }

    // ~1.5 req/sec — polite to Yahoo
    await sleep(700);

    if ((i + 1) % 20 === 0 || i === rows.length - 1) {
      process.stdout.write(`  ${i + 1}/${rows.length} tickers (ok:${ok} failed:${failed})\r`);
    }
  }

  console.log(`\nDone. ${ok} tickers updated, ${failed} failed.`);
  if (failures.length > 0) {
    console.log(`First failures (showing up to 10):`);
    for (const f of failures.slice(0, 10)) console.log(`  ${f}`);
  }

  // Quick summary
  const { rows: sample } = await client.query(`
    SELECT name, bhc_ticker, stock_price, market_cap, pe_ratio, pb_ratio
    FROM institutions
    WHERE stock_price IS NOT NULL
    ORDER BY market_cap DESC NULLS LAST
    LIMIT 15
  `);
  console.log('\nLargest banks by market cap:');
  for (const r of sample) {
    const mc  = r.market_cap  ? `$${(Number(r.market_cap) / 1e6).toFixed(1)}B` : '—';
    const px  = r.stock_price ? `$${Number(r.stock_price).toFixed(2)}` : '—';
    const pe  = r.pe_ratio    ? `P/E ${Number(r.pe_ratio).toFixed(1)}x` : '';
    const pb  = r.pb_ratio    ? `P/B ${Number(r.pb_ratio).toFixed(2)}x` : '';
    console.log(`  ${(r.bhc_ticker ?? '').padEnd(6)} ${r.name.slice(0, 36).padEnd(36)} ${mc.padStart(8)} ${px.padStart(8)} ${pe} ${pb}`);
  }

  await client.end();
}

main().catch(e => {
  console.error('sync-market failed:', e.message);
  process.exit(1);
});

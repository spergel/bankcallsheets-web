#!/usr/bin/env node
/**
 * Pulls capital ratios and loan composition from the FDIC BankFind API
 * and stores them in new institutions columns.
 *
 * Run once (or whenever you want fresh data):
 *   node scripts/sync-fdic.js
 *
 * New columns added:
 *   tier1_ratio FLOAT         — Tier 1 risk-based capital ratio (%)
 *   total_capital_ratio FLOAT — Total risk-based capital ratio (%)
 *   leverage_ratio FLOAT      — Tier 1 leverage ratio (%)
 *   cre_loans BIGINT          — Nonfarm nonresidential RE ($000s)
 *   construction_loans BIGINT — Construction & land development ($000s)
 *   ci_loans BIGINT           — C&I loans ($000s)
 *   residential_loans BIGINT  — 1-4 family residential loans ($000s)
 *   consumer_loans BIGINT     — Consumer/individual loans ($000s)
 *   nco_rate FLOAT            — Net charge-off rate (net charge-offs / net loans)
 */

require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

function getUrl() {
  const raw = process.env.DATABASE_URL ?? '';
  return raw.replace('-pooler', '');
}

const FDIC_BASE = 'https://banks.data.fdic.gov/api';
const FDIC_FIELDS = [
  'CERT', 'REPDTE',
  'RBC1RWAJR',  // Tier 1 RBC ratio
  'RBCRWAJ',    // Total RBC ratio
  'LEIRATE',    // Leverage ratio
  'LNRENRES',   // CRE (nonfarm nonresidential)
  'LNRECONS',   // Construction
  'LNCI',       // C&I
  'LNRERES',    // Residential 1-4 family
  'LNCON',      // Consumer
  'LNLSNET',    // Net loans (for NCO rate)
  'NETCHARGE',  // Net charge-offs
].join(',');

async function fetchFdic(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`FDIC API ${res.status}: ${url}`);
  return res.json();
}

async function getLatestRepdte() {
  const json = await fetchFdic(`${FDIC_BASE}/financials?fields=REPDTE&sort_by=REPDTE&sort_order=DESC&limit=1`);
  const repdte = json?.data?.[0]?.data?.REPDTE;
  if (!repdte) throw new Error('Could not determine latest FDIC report date');
  return repdte;
}

async function fetchAllForDate(repdte) {
  const results = new Map(); // cert -> row
  const PAGE = 10000;
  let offset = 0;
  let total = Infinity;

  while (offset < total) {
    const url = `${FDIC_BASE}/financials?filters=REPDTE%3A${repdte}&fields=${FDIC_FIELDS}&limit=${PAGE}&offset=${offset}`;
    const json = await fetchFdic(url);
    total = json?.meta?.total ?? 0;
    const rows = json?.data ?? [];
    for (const item of rows) {
      const d = item.data ?? item;
      const cert = String(d.CERT ?? '');
      if (cert) results.set(cert, d);
    }
    offset += PAGE;
    process.stdout.write(`  FDIC: fetched ${results.size.toLocaleString()} / ${total.toLocaleString()}\r`);
    if (rows.length === 0) break;
  }
  console.log();
  return results;
}

function floatOrNull(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function bigintOrNull(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return isNaN(n) ? null : Math.round(n);
}

async function main() {
  const client = new Client({ connectionString: getUrl() });
  await client.connect();
  console.log('Connected.');

  // Add columns idempotently
  for (const col of [
    'tier1_ratio FLOAT',
    'total_capital_ratio FLOAT',
    'leverage_ratio FLOAT',
    'cre_loans BIGINT',
    'construction_loans BIGINT',
    'ci_loans BIGINT',
    'residential_loans BIGINT',
    'consumer_loans BIGINT',
    'nco_rate FLOAT',
  ]) {
    const [name] = col.split(' ');
    await client.query(`ALTER TABLE institutions ADD COLUMN IF NOT EXISTS ${col}`);
    console.log(`Column ready: ${name}`);
  }
  await client.query(`CREATE INDEX IF NOT EXISTS idx_inst_tier1    ON institutions(tier1_ratio          DESC NULLS LAST)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_inst_cre      ON institutions(cre_loans             DESC NULLS LAST)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_inst_nco      ON institutions(nco_rate              ASC  NULLS LAST)`);

  // Find the latest FDIC reporting date
  console.log('Fetching latest FDIC report date…');
  const repdte = await getLatestRepdte();
  console.log(`Latest FDIC REPDTE: ${repdte}`);

  // Pull all financial data for that date
  console.log('Fetching FDIC financials…');
  const fdicMap = await fetchAllForDate(repdte);
  console.log(`Retrieved ${fdicMap.size.toLocaleString()} FDIC records.`);

  // Load our fdic_cert values
  const { rows: instRows } = await client.query(`SELECT idrssd, fdic_cert FROM institutions WHERE fdic_cert IS NOT NULL`);
  console.log(`Updating ${instRows.length.toLocaleString()} institutions…`);

  let updated = 0;
  const BATCH = 500;

  for (let i = 0; i < instRows.length; i += BATCH) {
    const batch = instRows.slice(i, i + BATCH);
    for (const { idrssd, fdic_cert } of batch) {
      const d = fdicMap.get(String(fdic_cert));
      if (!d) continue;

      const ncoRate = (() => {
        const nc = floatOrNull(d.NETCHARGE);
        const nl = floatOrNull(d.LNLSNET);
        if (nc == null || !nl || nl <= 0) return null;
        return nc / nl;
      })();

      await client.query(
        `UPDATE institutions SET
           tier1_ratio         = $1,
           total_capital_ratio = $2,
           leverage_ratio      = $3,
           cre_loans           = $4,
           construction_loans  = $5,
           ci_loans            = $6,
           residential_loans   = $7,
           consumer_loans      = $8,
           nco_rate            = $9
         WHERE idrssd = $10`,
        [
          floatOrNull(d.RBC1RWAJR),
          floatOrNull(d.RBCRWAJ),
          floatOrNull(d.LEIRATE),
          bigintOrNull(d.LNRENRES),
          bigintOrNull(d.LNRECONS),
          bigintOrNull(d.LNCI),
          bigintOrNull(d.LNRERES),
          bigintOrNull(d.LNCON),
          ncoRate,
          idrssd,
        ],
      );
      updated++;
    }
    process.stdout.write(`  ${Math.min(i + BATCH, instRows.length).toLocaleString()} / ${instRows.length.toLocaleString()} (${updated} updated)\r`);
  }

  console.log(`\nDone. ${updated.toLocaleString()} institutions updated from FDIC.`);
  await client.end();
}

main().catch(e => {
  console.error('sync-fdic failed:', e.message);
  process.exit(1);
});

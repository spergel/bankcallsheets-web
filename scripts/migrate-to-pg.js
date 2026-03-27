#!/usr/bin/env node
/**
 * One-time migration: loads data/index.tsv + data/banks/*.tsv into Neon Postgres.
 * Run once with your DATABASE_URL set in .env.local:
 *   node scripts/migrate-to-pg.js
 *
 * Uses a standard pg Client so it runs efficiently over a persistent TCP connection.
 */

require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const fs   = require('fs');
const path = require('path');

const DATA_DIR  = path.resolve(__dirname, '../../data');
const BANKS_DIR = path.join(DATA_DIR, 'banks');

function parseTSV(content) {
  const lines = content.split('\n').filter(l => l.length > 0);
  if (lines.length < 2) return [];
  const headers = lines[0].split('\t');
  return lines.slice(1).map(line => {
    const cols = line.split('\t');
    const row = {};
    for (let i = 0; i < headers.length; i++) row[headers[i]] = cols[i] ?? '';
    return row;
  });
}

function bigintOrNull(v) {
  if (!v || v === '') return null;
  const n = Number(v);
  return isNaN(n) ? null : Math.round(n);
}

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  console.log('Connected to Postgres.');

  // ── Schema ─────────────────────────────────────────────────────────────────
  await client.query(`
    CREATE TABLE IF NOT EXISTS institutions (
      idrssd           TEXT PRIMARY KEY,
      name             TEXT NOT NULL,
      state            CHAR(2),
      city             TEXT,
      zip              TEXT,
      address          TEXT,
      fdic_cert        TEXT,
      aba_routing      TEXT,
      filing_type      TEXT,
      latest_period    TEXT,
      total_assets     BIGINT,
      total_deposits   BIGINT,
      total_equity     BIGINT,
      net_income       BIGINT,
      past_due_30_89   BIGINT,
      past_due_90_plus BIGINT
    )
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS financials (
      idrssd          TEXT NOT NULL REFERENCES institutions(idrssd),
      period_end_date DATE NOT NULL,
      data            JSONB NOT NULL,
      PRIMARY KEY (idrssd, period_end_date)
    )
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS labels (
      code  TEXT PRIMARY KEY,
      label TEXT NOT NULL
    )
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_inst_state  ON institutions(state)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_inst_assets ON institutions(total_assets DESC NULLS LAST)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_fin_idrssd  ON financials(idrssd)`);
  console.log('Schema ready.');

  // ── Institutions ────────────────────────────────────────────────────────────
  const indexPath = path.join(DATA_DIR, 'index.tsv');
  if (!fs.existsSync(indexPath)) {
    console.error('data/index.tsv not found. Run: npm run ingest first.');
    process.exit(1);
  }
  const indexRows = parseTSV(fs.readFileSync(indexPath, 'utf8'));
  console.log(`Inserting ${indexRows.length.toLocaleString()} institutions…`);

  const INST_BATCH = 500;
  for (let i = 0; i < indexRows.length; i += INST_BATCH) {
    const batch  = indexRows.slice(i, i + INST_BATCH);
    const values = [];
    const params = [];
    let   n      = 1;
    for (const r of batch) {
      values.push(`($${n++},$${n++},$${n++},$${n++},$${n++},$${n++},$${n++},$${n++},$${n++},$${n++},$${n++},$${n++},$${n++},$${n++},$${n++},$${n++})`);
      params.push(
        r.idrssd, r.name, r.state || null, r.city || null, r.zip || null, r.address || null,
        r.fdic_cert || null, r.aba_routing || null, r.filing_type || null, r.latest_period || null,
        bigintOrNull(r.total_assets), bigintOrNull(r.total_deposits),
        bigintOrNull(r.total_equity), bigintOrNull(r.net_income),
        bigintOrNull(r.past_due_30_89), bigintOrNull(r.past_due_90_plus),
      );
    }
    await client.query(
      `INSERT INTO institutions
         (idrssd,name,state,city,zip,address,fdic_cert,aba_routing,filing_type,latest_period,
          total_assets,total_deposits,total_equity,net_income,past_due_30_89,past_due_90_plus)
       VALUES ${values.join(',')}
       ON CONFLICT (idrssd) DO UPDATE SET
         name=EXCLUDED.name, state=EXCLUDED.state, city=EXCLUDED.city, zip=EXCLUDED.zip,
         address=EXCLUDED.address, fdic_cert=EXCLUDED.fdic_cert, aba_routing=EXCLUDED.aba_routing,
         filing_type=EXCLUDED.filing_type, latest_period=EXCLUDED.latest_period,
         total_assets=EXCLUDED.total_assets, total_deposits=EXCLUDED.total_deposits,
         total_equity=EXCLUDED.total_equity, net_income=EXCLUDED.net_income,
         past_due_30_89=EXCLUDED.past_due_30_89, past_due_90_plus=EXCLUDED.past_due_90_plus`,
      params,
    );
    process.stdout.write(`  ${Math.min(i + INST_BATCH, indexRows.length).toLocaleString()} / ${indexRows.length.toLocaleString()}\r`);
  }
  console.log('\nInstitutions done.');

  // ── Labels ──────────────────────────────────────────────────────────────────
  const labelsPath = path.join(DATA_DIR, 'labels.tsv');
  if (fs.existsSync(labelsPath)) {
    const labelRows = parseTSV(fs.readFileSync(labelsPath, 'utf8')).filter(r => r.code && r.label);
    if (labelRows.length > 0) {
      const LBATCH = 500;
      for (let i = 0; i < labelRows.length; i += LBATCH) {
        const batch  = labelRows.slice(i, i + LBATCH);
        const values = [];
        const params = [];
        let   n      = 1;
        for (const r of batch) {
          values.push(`($${n++},$${n++})`);
          params.push(r.code, r.label);
        }
        await client.query(
          `INSERT INTO labels (code, label) VALUES ${values.join(',')}
           ON CONFLICT (code) DO UPDATE SET label=EXCLUDED.label`,
          params,
        );
      }
      console.log(`Labels done (${labelRows.length.toLocaleString()} codes).`);
    }
  }

  // ── Financials ───────────────────────────────────────────────────────────────
  if (!fs.existsSync(BANKS_DIR)) {
    console.log('No data/banks/ directory found — skipping financials.');
    await client.end();
    return;
  }
  const files = fs.readdirSync(BANKS_DIR).filter(f => f.endsWith('.tsv'));
  console.log(`Loading financials from ${files.length.toLocaleString()} bank files…`);

  let totalFinRows = 0;
  const FIN_BATCH = 200; // rows per INSERT

  for (let fi = 0; fi < files.length; fi++) {
    const idrssd = files[fi].replace('.tsv', '');
    const rows   = parseTSV(fs.readFileSync(path.join(BANKS_DIR, files[fi]), 'utf8'));
    if (rows.length === 0) continue;

    // Sub-batch: build VALUE lists of up to FIN_BATCH rows
    for (let bi = 0; bi < rows.length; bi += FIN_BATCH) {
      const batch  = rows.slice(bi, bi + FIN_BATCH);
      const values = [];
      const params = [];
      let   n      = 1;
      for (const row of batch) {
        const { period_end_date, ...data } = row;
        if (!period_end_date) continue;
        values.push(`($${n++},$${n++},$${n++})`);
        params.push(idrssd, period_end_date, JSON.stringify(data));
      }
      if (values.length > 0) {
        await client.query(
          `INSERT INTO financials (idrssd, period_end_date, data)
           VALUES ${values.join(',')}
           ON CONFLICT DO NOTHING`,
          params,
        );
      }
    }

    totalFinRows += rows.length;
    if (fi % 250 === 0 || fi === files.length - 1) {
      process.stdout.write(`  ${(fi + 1).toLocaleString()} / ${files.length.toLocaleString()} files  (${totalFinRows.toLocaleString()} rows)\r`);
    }
  }

  console.log(`\nFinancials done. ${totalFinRows.toLocaleString()} total rows.`);
  await client.end();
  console.log('Migration complete.');
}

main().catch(e => {
  console.error('\nMigration failed:', e.message);
  process.exit(1);
});

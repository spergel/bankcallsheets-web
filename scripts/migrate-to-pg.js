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

// Use direct (non-pooler) connection for bulk loading — avoids idle timeout.
// Neon pooler URLs contain "-pooler"; strip it for a direct TCP connection.
function getDirectUrl() {
  const url = process.env.DATABASE_URL ?? '';
  return url.replace('-pooler', '');
}

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

// Only the FFIEC codes bankMetrics.ts actually reads — keeps JSONB small enough
// to fit in Neon's 512 MB free tier (~52 codes vs 300+ in the raw files).
const KEEP_CODES = new Set([
  'RCFD2170','RCON2170',           // total_assets
  'RCFDB528','RCONB528',           // gross_loans
  'RCFDB529','RCONB529',           // net_loans
  'RCON2200','RCFN2200',           // deposits domestic/foreign
  'RCFD3210','RCON3210',           // total_equity
  'RCFD3123','RCON3123',           // alll
  'RCFD2150','RCON2150',           // oreo
  'RCFD1407','RCON1407',           // past_due_90
  'RCFD1403','RCON1403',           // nonaccrual
  'RCFD1406','RCON1406',           // past_due_30_89
  'RIAD4340',                      // net_income
  'RIAD4010',                      // interest_income
  'RIAD4073',                      // interest_expense
  'RIAD4074',                      // net_interest_inc
  'RIAD4079',                      // nonint_income
  'RIAD4093',                      // nonint_expense
  'RIAD4230',                      // provision
  'RCFD1754','RCON1754',           // htm_securities
  'RCFD1773','RCON1773',           // afs_securities
  'RCFD1350','RCON1350',           // fed_funds_sold
  'RCFD5369','RCON5369',           // loans_held_sale
  'RCFD3163','RCON3163',           // goodwill
  'RCFD0426','RCON0426',           // other_intangibles
  'RCFD3200','RCON3200',           // sub_debt
  'RCFD2800','RCON2800',           // fed_funds_purch
  'RCFD3190','RCON3190',           // other_borrowed
  'RCFD2948','RCON2948',           // total_liabilities
]);

function filterRow(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (KEEP_CODES.has(k) && v !== '' && v !== '0') out[k] = v;
  }
  return out;
}

function bigintOrNull(v) {
  if (!v || v === '') return null;
  const n = Number(v);
  return isNaN(n) ? null : Math.round(n);
}

async function main() {
  let client = new Client({
    connectionString: getDirectUrl(),
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
  });
  await client.connect();
  console.log('Connected to Postgres (direct).');

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
      past_due_90_plus BIGINT,
      roa              FLOAT,
      roe              FLOAT,
      nim              FLOAT,
      efficiency_ratio FLOAT,
      ltd_ratio        FLOAT,
      npl_ratio        FLOAT,
      coverage_ratio   FLOAT
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

  // Derived metric columns — idempotent for existing databases
  for (const col of ['roa','roe','nim','efficiency_ratio','ltd_ratio','npl_ratio','coverage_ratio']) {
    await client.query(`ALTER TABLE institutions ADD COLUMN IF NOT EXISTS ${col} FLOAT`);
  }
  await client.query(`CREATE INDEX IF NOT EXISTS idx_inst_roa  ON institutions(roa  DESC NULLS LAST)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_inst_nim  ON institutions(nim  DESC NULLS LAST)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_inst_eff  ON institutions(efficiency_ratio ASC  NULLS LAST)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_inst_npl  ON institutions(npl_ratio        ASC  NULLS LAST)`);

  // Clear any previously-loaded financials that used the full-JSONB schema
  // so we stay within Neon's 512 MB free tier.
  await client.query(`TRUNCATE TABLE financials`);
  console.log('Schema ready (financials cleared).');

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

  // Resume support: find banks that already have financials loaded.
  const { rows: doneRows } = await client.query(`SELECT DISTINCT idrssd FROM financials`);
  const done = new Set(doneRows.map(r => r.idrssd));
  const remaining = files.filter(f => !done.has(f.replace('.tsv', '')));
  console.log(`Loading financials: ${remaining.length.toLocaleString()} remaining of ${files.length.toLocaleString()} bank files…`);
  if (done.size > 0) console.log(`  (resuming — skipping ${done.size.toLocaleString()} already loaded)`);

  let totalFinRows = 0;
  const FIN_BATCH = 200;

  // Helper: insert one bank file, reconnecting if the connection drops.
  async function insertBankFile(cl, idrssd, rows) {
    for (let bi = 0; bi < rows.length; bi += FIN_BATCH) {
      const batch  = rows.slice(bi, bi + FIN_BATCH);
      const values = [];
      const params = [];
      let   n      = 1;
      for (const row of batch) {
        const { period_end_date, ...rawData } = row;
        if (!period_end_date) continue;
        const data = filterRow(rawData);
        if (Object.keys(data).length === 0) continue;
        values.push(`($${n++},$${n++},$${n++})`);
        params.push(idrssd, period_end_date, JSON.stringify(data));
      }
      if (values.length > 0) {
        await cl.query(
          `INSERT INTO financials (idrssd, period_end_date, data)
           VALUES ${values.join(',')}
           ON CONFLICT DO NOTHING`,
          params,
        );
      }
    }
  }

  // Helper: create and connect a fresh direct client.
  async function freshClient() {
    const cl = new Client({ connectionString: getDirectUrl(), keepAlive: true, keepAliveInitialDelayMillis: 10000 });
    await cl.connect();
    return cl;
  }

  for (let fi = 0; fi < remaining.length; fi++) {
    const fname  = remaining[fi];
    const idrssd = fname.replace('.tsv', '');
    const rows   = parseTSV(fs.readFileSync(path.join(BANKS_DIR, fname), 'utf8'));
    if (rows.length === 0) continue;

    // Retry loop — reconnect on connection drop.
    let attempts = 0;
    while (true) {
      try {
        await insertBankFile(client, idrssd, rows);
        break;
      } catch (err) {
        if (attempts++ >= 5) throw err;
        const msg = err.message ?? '';
        const isConnErr = msg.includes('terminated') || msg.includes('ECONNRESET') || msg.includes('connect') || msg.includes('timeout');
        if (!isConnErr) throw err;
        console.log(`\n  Connection dropped (${msg}). Reconnecting…`);
        try { await client.end(); } catch (_) {}
        client = await freshClient();
        console.log('  Reconnected.');
        // If this idrssd already got partially inserted in a prior attempt, ON CONFLICT DO NOTHING handles it.
      }
    }

    totalFinRows += rows.length;
    if (fi % 250 === 0 || fi === remaining.length - 1) {
      process.stdout.write(`  ${(fi + 1).toLocaleString()} / ${remaining.length.toLocaleString()} files  (${totalFinRows.toLocaleString()} rows)\r`);
    }
  }

  console.log(`\nFinancials done. ${totalFinRows.toLocaleString()} rows inserted.`);

  // ── Derived metrics ─────────────────────────────────────────────────────────
  // Compute ROA, ROE, NIM, efficiency, LTD, NPL, coverage from latest Q4 data.
  console.log('Computing derived metrics…');
  await client.query(`
    WITH latest_ann AS (
      SELECT DISTINCT ON (idrssd)
        idrssd, data
      FROM financials
      WHERE EXTRACT(MONTH FROM period_end_date) = 12
      ORDER BY idrssd, period_end_date DESC
    )
    UPDATE institutions SET
      roa = CASE
        WHEN total_assets > 0 AND (la.data->>'RIAD4340') IS NOT NULL
        THEN (la.data->>'RIAD4340')::float8 / total_assets
        ELSE NULL END,
      roe = CASE
        WHEN total_equity > 0 AND (la.data->>'RIAD4340') IS NOT NULL
        THEN (la.data->>'RIAD4340')::float8 / total_equity
        ELSE NULL END,
      nim = CASE
        WHEN total_assets > 0 AND (la.data->>'RIAD4074') IS NOT NULL
        THEN (la.data->>'RIAD4074')::float8 / total_assets
        ELSE NULL END,
      efficiency_ratio = CASE
        WHEN (la.data->>'RIAD4093') IS NOT NULL
          AND COALESCE((la.data->>'RIAD4074')::float8, 0) + COALESCE((la.data->>'RIAD4079')::float8, 0) > 0
        THEN (la.data->>'RIAD4093')::float8 / (
          COALESCE((la.data->>'RIAD4074')::float8, 0) +
          COALESCE((la.data->>'RIAD4079')::float8, 0)
        )
        ELSE NULL END,
      ltd_ratio = CASE
        WHEN total_deposits > 0
          AND COALESCE((la.data->>'RCFDB529')::float8, (la.data->>'RCONB529')::float8) IS NOT NULL
        THEN COALESCE((la.data->>'RCFDB529')::float8, (la.data->>'RCONB529')::float8) / total_deposits
        ELSE NULL END,
      npl_ratio = CASE
        WHEN COALESCE((la.data->>'RCFDB528')::float8, (la.data->>'RCONB528')::float8) > 0
        THEN (
          COALESCE((la.data->>'RCFD1407')::float8, (la.data->>'RCON1407')::float8, 0::float8) +
          COALESCE((la.data->>'RCFD1403')::float8, (la.data->>'RCON1403')::float8, 0::float8)
        ) / COALESCE((la.data->>'RCFDB528')::float8, (la.data->>'RCONB528')::float8)
        ELSE NULL END,
      coverage_ratio = CASE
        WHEN (
          COALESCE((la.data->>'RCFD1407')::float8, (la.data->>'RCON1407')::float8, 0::float8) +
          COALESCE((la.data->>'RCFD1403')::float8, (la.data->>'RCON1403')::float8, 0::float8)
        ) > 0
        THEN COALESCE((la.data->>'RCFD3123')::float8, (la.data->>'RCON3123')::float8) / (
          COALESCE((la.data->>'RCFD1407')::float8, (la.data->>'RCON1407')::float8, 0::float8) +
          COALESCE((la.data->>'RCFD1403')::float8, (la.data->>'RCON1403')::float8, 0::float8)
        )
        ELSE NULL END
    FROM latest_ann la
    WHERE institutions.idrssd = la.idrssd
  `);
  console.log('Derived metrics computed.');

  await client.end();
  console.log('Migration complete.');
}

main().catch(e => {
  console.error('\nMigration failed:', e.message);
  process.exit(1);
});

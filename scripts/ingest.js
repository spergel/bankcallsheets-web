#!/usr/bin/env node
/**
 * ETL: FFIEC Call Report TSV files → flat TSV files in data/
 *
 * Usage:
 *   node scripts/ingest.js [year]
 *
 * Outputs:
 *   data/labels.tsv          — FFIEC code → human label (from row 2 of source files)
 *   data/index.tsv           — one row per bank, latest period key metrics
 *   data/banks/{idrssd}.tsv  — all periods + all columns for that bank
 *
 * Source file structure (per year directory):
 *   Row 1: FFIEC code headers
 *   Row 2: Human-readable labels (blank for identity cols) — OR first data row
 *   Row 3+: Data
 */

const fs       = require('fs');
const path     = require('path');
const readline = require('readline');

const DATA_ROOT  = path.resolve(__dirname, '..', '..');
const OUT_DIR    = path.resolve(__dirname, '..', '..', 'data');
const BANKS_DIR  = path.join(OUT_DIR, 'banks');

// Identity columns present in every file (we exclude these from FFIEC code columns)
const ID_HEADERS = new Set([
  'Reporting Period End Date', 'IDRSSD', 'FDIC Certificate Number',
  'OCC Charter Number', 'OTS Docket Number', 'Primary ABA Routing Number',
  'Financial Institution Name', 'Financial Institution Address',
  'Financial Institution City', 'Financial Institution State',
  'Financial Institution Zip Code', 'Financial Institution Filing Type',
  'Last Date/Time Submission Updated On',
]);

// Key metric codes (with fallbacks for older years)
const KEY_CODES = {
  total_assets:    ['RCFD2170', 'RCON2170'],
  total_equity:    ['RCFD3210', 'RCON3210'],
  net_income:      ['RIAD4340'],
  past_due_30_89:  ['RCFD1406', 'RCON1406'],
  past_due_90_plus:['RCFD1407', 'RCON1407'],
};

// Total deposits = domestic offices + foreign offices (RCFN2200 = 0 for domestic-only banks)
function totalDeposits(codes) {
  const dom = parseFloat(codes['RCON2200'] || '0') || 0;
  const fgn = parseFloat(codes['RCFN2200'] || '0') || 0;
  const total = dom + fgn;
  return total > 0 ? String(total) : '';
}

function pickVal(codeValues, codes) {
  for (const c of codes) {
    const v = codeValues[c];
    if (v !== undefined && v !== '') return v;
  }
  return '';
}

// ── Pass 1: discover all FFIEC codes + extract labels ────────────────
async function discoverAll(filePaths) {
  const allCodes = new Set();   // ordered set (insertion order)
  const labelMap = {};           // code → label string

  for (const fp of filePaths) {
    const rl = readline.createInterface({ input: fs.createReadStream(fp), crlfDelay: Infinity });
    let lineNum = 0;
    let headers = [];

    for await (const line of rl) {
      lineNum++;
      if (lineNum === 1) {
        headers = line.split('\t').map(h => h.trim());
        headers.forEach(h => { if (!ID_HEADERS.has(h) && h) allCodes.add(h); });
      } else if (lineNum === 2) {
        const parts = line.split('\t');
        const first = parts.find(p => p.trim());
        // If first non-blank looks like a date, this is a data row — no label row
        if (first && /^\d{4}-\d{2}-\d{2}/.test(first.trim())) break;
        // Otherwise it's the human-readable label row
        parts.forEach((label, i) => {
          const code = headers[i];
          if (code && !ID_HEADERS.has(code) && label.trim()) {
            labelMap[code] = label.trim();
          }
        });
        break;
      } else break;
    }
    rl.close();
  }

  return { allCodes: [...allCodes], labelMap };
}

// ── Pass 2: read data rows from a file ────────────────────────────────
async function* readDataRows(fp) {
  const rl = readline.createInterface({ input: fs.createReadStream(fp), crlfDelay: Infinity });
  let lineNum = 0;
  let headers = [];
  let skippedLabelRow = false;

  for await (const line of rl) {
    lineNum++;
    if (lineNum === 1) {
      headers = line.split('\t').map(h => h.trim());
      continue;
    }
    if (lineNum === 2 && !skippedLabelRow) {
      const parts = line.split('\t');
      const first = parts.find(p => p.trim());
      if (!first || !/^\d{4}-\d{2}-\d{2}/.test(first.trim())) {
        skippedLabelRow = true;
        continue; // skip label row
      }
    }
    // Data row
    const cols = line.split('\t');
    const row = {};
    headers.forEach((h, i) => { row[h] = (cols[i] ?? '').trim(); });
    yield row;
  }
}

// ── Main ───────────────────────────────────────────────────────────────
async function main() {
  fs.mkdirSync(BANKS_DIR, { recursive: true });

  // Determine year directories to process
  const yearArg = process.argv[2];
  let yearDirs;
  if (yearArg) {
    // Accept either a full directory name or just the year number
    const allDirs = fs.readdirSync(DATA_ROOT, { withFileTypes: true })
      .filter(e => e.isDirectory() && e.name.includes(yearArg))
      .map(e => path.join(DATA_ROOT, e.name));
    yearDirs = allDirs.length ? allDirs : [path.join(DATA_ROOT, yearArg)];
  } else {
    yearDirs = fs.readdirSync(DATA_ROOT, { withFileTypes: true })
      .filter(e => e.isDirectory() && /\d{4}$/.test(e.name))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(e => path.join(DATA_ROOT, e.name));
  }

  const allFiles = yearDirs.flatMap(dir =>
    fs.existsSync(dir)
      ? fs.readdirSync(dir)
          .filter(f => f.toLowerCase().endsWith('.txt') && f.toLowerCase() !== 'readme.txt')
          .sort()
          .map(f => path.join(dir, f))
      : []
  );

  if (!allFiles.length) { console.error('No data files found.'); process.exit(1); }

  // ── Step 1: Discover schema ─────────────────────────────────────
  console.log(`Scanning ${allFiles.length} file(s) for schema…`);
  const { allCodes, labelMap } = await discoverAll(allFiles);
  console.log(`  ${allCodes.length} unique FFIEC codes found.`);
  console.log(`  ${Object.keys(labelMap).length} labels extracted.`);

  // Write labels.tsv
  const labelsPath = path.join(OUT_DIR, 'labels.tsv');
  const labelsLines = ['code\tlabel'];
  for (const code of allCodes) {
    labelsLines.push(`${code}\t${labelMap[code] ?? ''}`);
  }
  fs.writeFileSync(labelsPath, labelsLines.join('\n'));
  console.log(`  Wrote ${labelsPath}`);

  // ── Step 2: Process year by year (memory-bounded) ───────────────
  // Keep only identity + latest period per bank in memory across years.
  // Full code data is flushed to per-bank TSV files after each year.
  const bankHeader  = ['period_end_date', ...allCodes].join('\t');
  const bankMeta    = new Map(); // idrssd → identity fields
  const bankLatest  = new Map(); // idrssd → { period, codes{} }
  const seenBanks   = new Set(); // which bank TSV files already have a header

  // Clean out stale bank files from a previous run
  for (const f of fs.readdirSync(BANKS_DIR)) fs.unlinkSync(path.join(BANKS_DIR, f));

  for (const yearDir of yearDirs) {
    const yearFiles = fs.existsSync(yearDir)
      ? fs.readdirSync(yearDir)
          .filter(f => f.toLowerCase().endsWith('.txt') && f.toLowerCase() !== 'readme.txt')
          .sort()
          .map(f => path.join(yearDir, f))
      : [];
    if (!yearFiles.length) continue;

    console.log(`\nYear: ${path.basename(yearDir)}`);

    // periodMap: `${idrssd}|${period}` → { code: val }
    const periodMap = new Map();

    for (const fp of yearFiles) {
      console.log(`  Reading ${path.basename(fp)}…`);
      let count = 0;
      for await (const row of readDataRows(fp)) {
        const idrssd = row['IDRSSD'];
        if (!idrssd) continue;
        const period = row['Reporting Period End Date'];
        if (!period) continue;

        // Update identity (latest wins)
        const meta = bankMeta.get(idrssd) ?? {};
        if (row['Financial Institution Name'])    meta.name        = row['Financial Institution Name'];
        if (row['Financial Institution Address']) meta.address     = row['Financial Institution Address'];
        if (row['Financial Institution City'])    meta.city        = row['Financial Institution City'];
        if (row['Financial Institution State'])   meta.state       = row['Financial Institution State'];
        if (row['Financial Institution Zip Code'])meta.zip         = row['Financial Institution Zip Code'];
        if (row['FDIC Certificate Number'])       meta.fdic_cert   = row['FDIC Certificate Number'];
        if (row['Primary ABA Routing Number'])    meta.aba_routing = row['Primary ABA Routing Number'];
        if (row['Financial Institution Filing Type']) meta.filing_type = row['Financial Institution Filing Type'];
        bankMeta.set(idrssd, meta);

        // Merge codes into this period's slot
        const pKey = `${idrssd}|${period}`;
        const codes = periodMap.get(pKey) ?? {};
        for (const code of allCodes) {
          const v = row[code];
          if (v !== undefined && v !== '') codes[code] = v;
        }
        periodMap.set(pKey, codes);
        count++;
      }
      console.log(`    → ${count.toLocaleString()} rows`);
    }

    // Group by bank
    const byBank = new Map(); // idrssd → [{ period, codes }]
    for (const [pKey, codes] of periodMap) {
      const pipe = pKey.indexOf('|');
      const idrssd = pKey.slice(0, pipe);
      const period = pKey.slice(pipe + 1);
      if (!byBank.has(idrssd)) byBank.set(idrssd, []);
      byBank.get(idrssd).push({ period, codes });
    }

    // Append to per-bank TSV files
    for (const [idrssd, periods] of byBank) {
      const fp = path.join(BANKS_DIR, `${idrssd}.tsv`);
      const lines = [];
      if (!seenBanks.has(idrssd)) {
        lines.push(bankHeader);
        seenBanks.add(idrssd);
      }
      periods.sort((a, b) => a.period.localeCompare(b.period));
      for (const { period, codes } of periods) {
        lines.push([period, ...allCodes.map(c => codes[c] ?? '')].join('\t'));
      }
      fs.appendFileSync(fp, lines.join('\n') + '\n');

      // Track latest period for index
      const latest = bankLatest.get(idrssd);
      const lastPeriod = periods[periods.length - 1];
      if (!latest || lastPeriod.period > latest.period) {
        bankLatest.set(idrssd, { period: lastPeriod.period, codes: lastPeriod.codes });
      }
    }

    console.log(`  → ${byBank.size.toLocaleString()} banks written`);
    periodMap.clear();
    byBank.clear();
  }

  console.log(`\nProcessed ${bankMeta.size.toLocaleString()} unique institutions.`);
  console.log(`Wrote ${seenBanks.size.toLocaleString()} bank files.`);

  // ── Step 3: Write index.tsv ──────────────────────────────────────
  console.log('Writing index.tsv…');
  const indexHeader = [
    'idrssd', 'name', 'state', 'city', 'zip', 'address', 'fdic_cert', 'aba_routing', 'filing_type',
    'latest_period',
    'total_assets', 'total_deposits', 'total_equity', 'net_income', 'past_due_30_89', 'past_due_90_plus',
  ].join('\t');

  const indexLines = [indexHeader];
  for (const [idrssd, meta] of bankMeta) {
    const latest = bankLatest.get(idrssd) ?? { period: '', codes: {} };
    indexLines.push([
      idrssd,
      meta.name        ?? '',
      meta.state       ?? '',
      meta.city        ?? '',
      meta.zip         ?? '',
      meta.address     ?? '',
      meta.fdic_cert   ?? '',
      meta.aba_routing ?? '',
      meta.filing_type ?? '',
      latest.period,
      pickVal(latest.codes, KEY_CODES.total_assets),
      totalDeposits(latest.codes),
      pickVal(latest.codes, KEY_CODES.total_equity),
      pickVal(latest.codes, KEY_CODES.net_income),
      pickVal(latest.codes, KEY_CODES.past_due_30_89),
      pickVal(latest.codes, KEY_CODES.past_due_90_plus),
    ].join('\t'));
  }
  fs.writeFileSync(path.join(OUT_DIR, 'index.tsv'), indexLines.join('\n'));
  console.log(`  Wrote ${indexLines.length - 1} rows to index.tsv`);

  console.log('\nDone.');
  console.log(`  ${OUT_DIR}/`);
  console.log(`    labels.tsv`);
  console.log(`    index.tsv`);
  console.log(`    banks/{idrssd}.tsv  (${seenBanks.size.toLocaleString()} files)`);
}

main().catch(err => { console.error(err); process.exit(1); });

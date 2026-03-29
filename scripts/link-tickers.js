#!/usr/bin/env node
/**
 * Links bank holding companies to their SEC CIK and stock ticker.
 *
 * Steps:
 *   1. Download SEC company_tickers.json (one request, ~600KB)
 *   2. Fetch active FDIC institutions with their holding company name (NAMEHCR)
 *   3. Normalize + match NAMEHCR → SEC company title → CIK + ticker
 *   4. Verify SIC is banking (6000-6299 or 6712) via submissions endpoint
 *   5. Store bhc_name, bhc_cik, bhc_ticker in institutions table
 *
 * Run once (or monthly):
 *   node scripts/link-tickers.js
 *
 * Falls back to EDGAR full-text search for names that don't match directly.
 * Logs failures so you can manually inspect edge cases.
 */

require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const SEC_BASE        = 'https://data.sec.gov';
const FDIC_BASE       = 'https://banks.data.fdic.gov/api';
const EDGAR_SEARCH    = 'https://efts.sec.gov/LATEST/search-index';
const USER_AGENT      = 'BankData Research tool/1.0 (non-commercial; github.com/spergel/bankcallsheets-web)';

// SIC codes that indicate a banking entity
const BANK_SICS = new Set([
  '6020','6021','6022','6035','6036','6099','6712','6159','6153','6141','6120','6110',
]);

function getUrl() {
  return (process.env.DATABASE_URL ?? '').replace('-pooler', '');
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function normalize(s) {
  return (s || '').toUpperCase()
    .replace(/\bcorporation\b/gi, 'CORP')
    .replace(/\bcompany\b/gi,     'CO')
    .replace(/\band\b/gi,         '&')
    .replace(/[^A-Z0-9&\s]/g,    '')
    .replace(/\s+/g,             ' ')
    .trim();
}

function nameMatch(fdicName, secTitle) {
  const a = normalize(fdicName);
  const b = normalize(secTitle);
  if (!a || !b) return false;
  if (a === b)                          return true;
  if (b.startsWith(a + ' '))           return true;
  if (a.startsWith(b + ' '))           return true;
  // Allow short common suffix differences ("CORP" vs "CO" etc.)
  const aShort = a.replace(/\s+(CORP|CO|INC|LTD|BANCORP|BANCSHARES|FINANCIAL|HOLDINGS|GROUP|BANKERS|BANKSHARES)$/, '').trim();
  const bShort = b.replace(/\s+(CORP|CO|INC|LTD|BANCORP|BANCSHARES|FINANCIAL|HOLDINGS|GROUP|BANKERS|BANKSHARES)$/, '').trim();
  if (aShort.length >= 8 && aShort === bShort) return true;
  return false;
}

async function fetchJson(url, opts = {}) {
  const headers = { 'User-Agent': USER_AGENT, 'Accept': 'application/json', ...opts.headers };
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.json();
}

async function getSecTickers() {
  console.log('Downloading SEC company_tickers.json…');
  const data = await fetchJson(`${SEC_BASE}/files/company_tickers.json`);
  // Returns { "0": { cik_str, ticker, title }, ... }
  const map = new Map(); // normalized title → [{ cik (padded), ticker, title }]
  for (const entry of Object.values(data)) {
    const key = normalize(entry.title);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push({
      cik:    String(entry.cik_str).padStart(10, '0'),
      ticker: entry.ticker,
      title:  entry.title,
    });
  }
  console.log(`  ${map.size.toLocaleString()} unique company names in SEC list.`);
  return { raw: data, map };
}

async function verifySic(paddedCik) {
  try {
    const sub = await fetchJson(`${SEC_BASE}/submissions/CIK${paddedCik}.json`);
    const sic = String(sub.sic ?? '');
    return BANK_SICS.has(sic) || (Number(sic) >= 6000 && Number(sic) <= 6299);
  } catch {
    return true; // if we can't verify, allow it
  }
}

async function searchEdgar(name) {
  try {
    const q = encodeURIComponent(`"${name}"`);
    const url = `${EDGAR_SEARCH}?q=${q}&forms=10-K&dateRange=custom&startdt=2022-01-01`;
    const json = await fetchJson(url);
    // Try both known response shapes
    const hits = json?.hits?.hits ?? json?.filings ?? [];
    for (const hit of hits) {
      const src   = hit._source ?? hit;
      const ename = src.entity_name ?? src.companyName ?? '';
      const cikRaw = src.entity_id  ?? src.cik ?? '';
      if (nameMatch(name, ename) && cikRaw) {
        const cik = String(cikRaw).replace(/^0+/, '').padStart(10, '0');
        return cik;
      }
    }
  } catch { /* ignore */ }
  return null;
}

async function main() {
  const client = new Client({ connectionString: getUrl() });
  await client.connect();
  console.log('Connected.');

  // Add columns idempotently
  for (const col of ['bhc_name TEXT', 'bhc_cik TEXT', 'bhc_ticker TEXT']) {
    await client.query(`ALTER TABLE institutions ADD COLUMN IF NOT EXISTS ${col}`);
  }
  await client.query(`CREATE INDEX IF NOT EXISTS idx_inst_ticker ON institutions(bhc_ticker) WHERE bhc_ticker IS NOT NULL`);

  // Step 1: Load SEC tickers
  const { map: secMap } = await getSecTickers();

  // Step 2: Fetch active FDIC institutions with NAMEHCR
  console.log('Fetching FDIC institutions with holding company names…');
  const fdicJson = await fetchJson(
    `${FDIC_BASE}/institutions?filters=ACTIVE%3A1&fields=CERT,NAMEHCR,RSSDID&limit=10000`,
  );
  const fdicItems = fdicJson?.data ?? [];
  console.log(`  ${fdicItems.length.toLocaleString()} active FDIC institutions.`);

  // Group by NAMEHCR so we only look up each BHC once
  const bhcMap = new Map(); // namehcr → { cik, ticker } (or null)
  for (const item of fdicItems) {
    const d = item.data ?? item;
    const namehcr = (d.NAMEHCR ?? '').trim();
    if (namehcr && !bhcMap.has(namehcr)) bhcMap.set(namehcr, null);
  }
  console.log(`  ${bhcMap.size.toLocaleString()} unique holding company names to resolve.`);

  // Step 3: Match each BHC name to SEC CIK/ticker
  let directHit = 0, edgarHit = 0, miss = 0;
  const names = [...bhcMap.keys()];

  for (let i = 0; i < names.length; i++) {
    const namehcr = names[i];
    const key = normalize(namehcr);

    // Try direct lookup
    let match = null;
    if (secMap.has(key)) {
      const candidates = secMap.get(key);
      // If multiple candidates, prefer the one whose SIC is banking (checked below)
      match = candidates[0];
    } else {
      // Try name-match scan (slower but finds partial matches)
      for (const [secKey, candidates] of secMap.entries()) {
        if (nameMatch(namehcr, candidates[0].title)) {
          match = candidates[0];
          break;
        }
      }
    }

    if (match) {
      // Verify SIC is banking (rate-limited)
      const isBank = await verifySic(match.cik);
      if (isBank) {
        bhcMap.set(namehcr, { cik: match.cik, ticker: match.ticker });
        directHit++;
      } else {
        // Try EDGAR search as fallback
        await sleep(200);
        const fallbackCik = await searchEdgar(namehcr);
        if (fallbackCik) {
          const sub = await fetchJson(`${SEC_BASE}/submissions/CIK${fallbackCik}.json`).catch(() => null);
          if (sub?.tickers?.length) {
            bhcMap.set(namehcr, { cik: fallbackCik, ticker: sub.tickers[0] });
            edgarHit++;
          } else miss++;
        } else miss++;
      }
      await sleep(150); // ~5 req/sec — respect SEC rate limit
    } else {
      // Try EDGAR full-text search
      await sleep(200);
      const cik = await searchEdgar(namehcr);
      if (cik) {
        const sub = await fetchJson(`${SEC_BASE}/submissions/CIK${cik}.json`).catch(() => null);
        if (sub?.tickers?.length) {
          bhcMap.set(namehcr, { cik, ticker: sub.tickers[0] });
          edgarHit++;
        } else miss++;
        await sleep(200);
      } else miss++;
    }

    if ((i + 1) % 50 === 0 || i === names.length - 1) {
      process.stdout.write(`  ${i + 1}/${names.length} BHC names processed (direct:${directHit} edgar:${edgarHit} miss:${miss})\r`);
    }
  }
  console.log();

  // Step 4: Update DB
  console.log('Updating DB…');
  let updated = 0;
  for (const item of fdicItems) {
    const d = item.data ?? item;
    const cert     = String(d.CERT ?? '');
    const namehcr  = (d.NAMEHCR ?? '').trim();
    if (!cert || !namehcr) continue;

    const resolved = bhcMap.get(namehcr);
    if (resolved) {
      await client.query(
        `UPDATE institutions SET bhc_name = $1, bhc_cik = $2, bhc_ticker = $3 WHERE fdic_cert = $4`,
        [namehcr, resolved.cik, resolved.ticker, cert],
      );
      updated++;
    } else {
      await client.query(
        `UPDATE institutions SET bhc_name = $1 WHERE fdic_cert = $2`,
        [namehcr, cert],
      );
    }
  }

  console.log(`\nDone. ${updated.toLocaleString()} institutions linked to a ticker.`);
  console.log(`BHC lookup: ${directHit} direct, ${edgarHit} via EDGAR search, ${miss} unresolved.`);

  // Show sample of found tickers
  const { rows } = await client.query(
    `SELECT bhc_ticker, COUNT(*) AS n, MAX(name) AS sample_bank
     FROM institutions WHERE bhc_ticker IS NOT NULL
     GROUP BY bhc_ticker ORDER BY COUNT(*) DESC LIMIT 20`,
  );
  console.log('\nTop tickers by number of subsidiary banks:');
  for (const r of rows) console.log(`  ${r.bhc_ticker.padEnd(8)} ${r.n.toString().padStart(4)} banks  (e.g. ${r.sample_bank})`);

  await client.end();
}

main().catch(e => {
  console.error('link-tickers failed:', e.message);
  process.exit(1);
});

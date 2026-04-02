#!/usr/bin/env node
/**
 * Links bank holding companies to their SEC CIK and stock ticker.
 *
 * Steps:
 *   1. Download SEC company_tickers.json + company_tickers_exchange.json
 *   2. Fetch active FDIC institutions with their holding company name (NAMEHCR)
 *   3. Normalize + match NAMEHCR → SEC company title → CIK + ticker
 *   4. Verify SIC is banking (6000-6299 or 6712) via submissions endpoint
 *   5. Phase D: EDGAR SIC browse for still-unresolved names (catches OTC banks)
 *   6. Store bhc_name, bhc_cik, bhc_ticker in institutions table
 *
 * Run once (or monthly):
 *   node scripts/link-tickers.js
 */

require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const SEC_BASE        = 'https://data.sec.gov';
const SEC_WWW         = 'https://www.sec.gov';
const FDIC_BASE       = 'https://banks.data.fdic.gov/api';
// SEC requires "Company Name email@domain.com" format per their usage guidelines
const USER_AGENT      = 'BankData/1.0 contact@bankcallsheets.com';

// SIC codes for EDGAR SIC browse (Phase D)
// 6020=mutual savings, 6021=national commercial, 6022=state commercial,
// 6035=federally chartered savings, 6036=state savings
const BANKING_SICS_BROWSE = ['6021','6022','6035','6036'];

// SIC codes that indicate a banking entity (for SIC verification)
const BANK_SICS = new Set([
  '6020','6021','6022','6035','6036','6099','6712','6159','6153','6141','6120','6110',
]);

function getUrl() {
  return (process.env.DATABASE_URL ?? '').replace('-pooler', '');
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function normalize(s) {
  return (s || '').toUpperCase()
    .replace(/\s*\/[A-Z]{2,4}\/?/g, ' ')  // strip SEC state qualifiers FIRST: /MN, /RI/, /NEW/, /MD/ etc.
    .replace(/\s*&\s*/g,          ' & ')   // normalize spacing around &
    // Handle N.A. / N.A before punct strip so it doesn't collapse to bare "NA"
    .replace(/\bN\.A\.?\b/g,      'NATIONAL ASSOCIATION')
    .replace(/\bbancorporation\b/gi, 'BANCORP')  // "WESTERN ALLIANCE BANCORPORATION" → "...BANCORP"
    .replace(/\bcorporation\b/gi, 'CORP')
    .replace(/\bcompany\b/gi,     'CO')
    .replace(/\band\b/gi,         '&')
    // Expand common FDIC abbreviations to match SEC full names
    .replace(/\bfinl\b/gi,        'FINANCIAL')
    .replace(/\bfncl\b/gi,        'FINANCIAL')
    .replace(/\bbcorp\b/gi,       'BANCORP')
    .replace(/\bbshrs\b/gi,       'BANCSHARES')
    .replace(/\bnatl\b/gi,        'NATIONAL')
    .replace(/\bnatl assn\b/gi,   'NATIONAL ASSOCIATION')
    .replace(/\bn a\b/gi,         'NATIONAL ASSOCIATION')  // catches "N A" after punct strip
    .replace(/\bassoc\b/gi,       'ASSOCIATION')
    .replace(/\bassn\b/gi,        'ASSOCIATION')
    .replace(/\bsvcs\b/gi,        'SERVICES')
    .replace(/\bsvc\b/gi,         'SERVICES')
    .replace(/\bu s\b/gi,         'US')    // "U S BANCORP" → "US BANCORP"
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

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/xml, text/xml, */*' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.text();
}

/** Extract all CIKs from an EDGAR Atom XML page. Names are broken in the feed (Perl stringification bug). */
function parseCiksFromAtom(xml) {
  return [...xml.matchAll(/<cik>(\d+)<\/cik>/g)].map(m => m[1].padStart(10, '0'));
}

/**
 * Build secMap from company_tickers.json, augmented by company_tickers_exchange.json.
 * The exchange file catches major banks (CMA, SNV, WAL…) absent from the main file.
 */
async function getSecTickers() {
  console.log('Downloading SEC company_tickers.json…');
  const data = await fetchJson(`${SEC_WWW}/files/company_tickers.json`);
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
  console.log(`  ${map.size.toLocaleString()} unique company names in company_tickers.json.`);

  // Augment with exchange-listed companies (different format, may include banks absent above)
  console.log('Downloading company_tickers_exchange.json…');
  try {
    const data2 = await fetchJson(`${SEC_WWW}/files/company_tickers_exchange.json`);
    // Format: { fields: ["cik","name","ticker","exchange"], data: [[cik, name, ticker, exchange], ...] }
    let added = 0;
    for (const row of (data2.data ?? [])) {
      const [cikNum, name, ticker] = row;
      if (!cikNum || !name || !ticker) continue;
      const key = normalize(name);
      const cik = String(cikNum).padStart(10, '0');
      if (!map.has(key)) {
        map.set(key, [{ cik, ticker, title: name }]);
        added++;
      } else if (!map.get(key).some(e => e.cik === cik)) {
        map.get(key).push({ cik, ticker, title: name });
        added++;
      }
    }
    console.log(`  +${added} new entries from exchange list → ${map.size.toLocaleString()} total names.`);
  } catch (e) {
    console.warn('  company_tickers_exchange.json failed:', e.message);
  }

  return { map };
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

/**
 * Phase D step 1: Collect all banking CIKs from EDGAR Atom browse by SIC code.
 * The Atom feed's company name field is broken (Perl stringification), so we only
 * extract CIKs here — names come from submissions in the next step.
 * Returns Set<paddedCik>.
 */
async function getBankingCiksFromEdgar() {
  const result = new Set();
  for (const sic of BANKING_SICS_BROWSE) {
    let start = 0;
    const count = 100;
    process.stdout.write(`  SIC ${sic}: `);
    let pageCount = 0;
    while (true) {
      const url = `${SEC_WWW}/cgi-bin/browse-edgar?action=getcompany&SIC=${sic}&owner=include&count=${count}&start=${start}&output=atom`;
      let xml;
      try {
        xml = await fetchText(url);
      } catch (e) {
        process.stdout.write(`(error: ${e.message})\n`);
        break;
      }
      const ciks = parseCiksFromAtom(xml);
      for (const cik of ciks) result.add(cik);
      pageCount += ciks.length;
      process.stdout.write(`${pageCount}…`);
      if (ciks.length < count) break;
      start += count;
      await sleep(250);
    }
    process.stdout.write('\n');
  }
  return result; // Set of padded CIKs
}

async function main() {
  // Phase 1: DB schema setup (quick — connect/disconnect immediately)
  {
    const client = new Client({ connectionString: getUrl() });
    await client.connect();
    console.log('Connected (schema setup).');
    for (const col of ['bhc_name TEXT', 'bhc_cik TEXT', 'bhc_ticker TEXT']) {
      await client.query(`ALTER TABLE institutions ADD COLUMN IF NOT EXISTS ${col}`);
    }
    await client.query(`CREATE INDEX IF NOT EXISTS idx_inst_ticker ON institutions(bhc_ticker) WHERE bhc_ticker IS NOT NULL`);
    await client.end();
    console.log('Schema ready, disconnected.');
  }

  // Step 1: Load SEC tickers (company_tickers.json + company_tickers_exchange.json)
  const { map: secMap } = await getSecTickers();

  // Step 2: Fetch FDIC institutions with NAMEHCR (all, not just ACTIVE=1).
  // Comerica, Synovus and others are ACTIVE=0 in FDIC but still in our DB from FFIEC data.
  // We paginate to get all ~27K institutions (3 requests of 10K each).
  console.log('Fetching all FDIC institutions with holding company names…');
  const fdicItems = [];
  {
    let offset = 0;
    const limit = 10000;
    while (true) {
      const page = await fetchJson(
        `${FDIC_BASE}/institutions?fields=CERT,NAME,NAMEHCR,RSSDID&limit=${limit}&offset=${offset}`,
      );
      const batch = page?.data ?? [];
      fdicItems.push(...batch);
      if (batch.length < limit) break;
      offset += limit;
      await sleep(500); // be polite
    }
  }
  console.log(`  ${fdicItems.length.toLocaleString()} total FDIC institutions (active + inactive).`);

  // Group by NAMEHCR so we look up each BHC only once.
  // For banks with no NAMEHCR (bank IS the BHC), use the bank's own name.
  const bhcMap = new Map(); // key → { cik, ticker } (or null)
  const itemKey = (d) => (d.NAMEHCR ?? '').trim() || (d.NAME ?? '').trim();
  for (const item of fdicItems) {
    const d = item.data ?? item;
    const k = itemKey(d);
    if (k && !bhcMap.has(k)) bhcMap.set(k, null);
  }
  console.log(`  ${bhcMap.size.toLocaleString()} unique holding company names to resolve.`);

  // Step 3: Three-phase matching
  //
  // Phase A (pure JS): collect SEC candidates for each FDIC name, no HTTP
  // Phase B (HTTP, deduplicated): verify SIC once per unique candidate CIK
  // Phase C (pure JS): assign first verified-banking candidate

  const names = [...bhcMap.keys()];

  // Phase A — pure JS name matching, no HTTP
  //
  // Optimization: pre-normalize all SEC titles once and build an O(1) short-suffix index.
  // This avoids re-running normalize() 8K× for each of 17K FDIC names.
  // Falls back to O(m) "startsWith" scan only for the small subset of names that survive
  // exact and short-suffix lookups.
  console.log('Phase A: Building SEC name indexes…');
  const SUFFIX_RE = /\s+(CORP|CO|INC|LTD|BANCORP|BANCSHARES|FINANCIAL|HOLDINGS|GROUP|BANKERS|BANKSHARES)$/;
  const secList    = []; // [{ normTitle, candidates }] — pre-normalized for startsWith scan
  const secShortMap = new Map(); // stripped-normalized title → first candidates list found
  for (const [normKey, candidates] of secMap.entries()) {
    secList.push({ normTitle: normKey, candidates });
    const short = normKey.replace(SUFFIX_RE, '').trim();
    if (short.length >= 8 && !secShortMap.has(short)) secShortMap.set(short, candidates);
  }

  console.log('Phase A: Name matching…');
  const candidateMap = new Map(); // namehcr → [sec_candidate, ...]
  for (const namehcr of names) {
    const norm = normalize(namehcr); // called once per FDIC name

    // 1. Exact key lookup: O(1)
    if (secMap.has(norm)) {
      candidateMap.set(namehcr, secMap.get(norm)); continue;
    }
    // 2. Short suffix lookup: O(1) — handles "BANCORP" vs "BANCSHARES" vs "INC" differences
    const short = norm.replace(SUFFIX_RE, '').trim();
    if (short.length >= 8 && secShortMap.has(short)) {
      candidateMap.set(namehcr, secShortMap.get(short)); continue;
    }
    // 3. StartsWith scan: O(m) — catches cases where one name is a prefix of the other.
    // Pre-normalized secList avoids re-running normalize() inside the inner loop.
    for (const { normTitle, candidates } of secList) {
      if (normTitle.startsWith(norm + ' ') || norm.startsWith(normTitle + ' ')) {
        candidateMap.set(namehcr, candidates); break;
      }
    }
  }
  console.log(`  ${candidateMap.size} FDIC names have ≥1 SEC candidate.`);

  // Phase B — HTTP, but each unique CIK verified only once
  const uniqueCiks = [...new Set([...candidateMap.values()].flat().map(c => c.cik))];
  console.log(`Phase B: Verifying SIC for ${uniqueCiks.length} unique CIKs…`);
  const bankingCiks = new Set();
  for (let i = 0; i < uniqueCiks.length; i++) {
    if (await verifySic(uniqueCiks[i])) bankingCiks.add(uniqueCiks[i]);
    await sleep(150);
    if ((i + 1) % 50 === 0 || i === uniqueCiks.length - 1) {
      process.stdout.write(`  ${i + 1}/${uniqueCiks.length} CIKs checked (banking: ${bankingCiks.size})\r`);
    }
  }
  console.log(`\n  ${bankingCiks.size} verified banking CIKs.`);

  // Phase C — pure JS assignment
  let directHit = 0, miss = 0;
  for (const namehcr of names) {
    const candidates = candidateMap.get(namehcr) ?? [];
    const bankMatch  = candidates.find(c => bankingCiks.has(c.cik));
    if (bankMatch) {
      bhcMap.set(namehcr, { cik: bankMatch.cik, ticker: bankMatch.ticker });
      directHit++;
    } else {
      miss++;
    }
  }
  console.log(`Phase C done: ${directHit} matched, ${miss} unresolved.`);

  // Phase D — EDGAR SIC browse + submissions fetch for still-unresolved names
  //
  // The SEC's company_tickers.json is incomplete: major banks like CMA, SNV, WAL are
  // absent. Phase D collects all banking CIKs from EDGAR's Atom feed, then fetches
  // submissions for CIKs not already known to get their name + ticker. Any with tickers
  // are added to secMap and re-matched against unresolved FDIC names.
  let edgarHit = 0;
  {
    // Build reverse CIK index (which CIKs we already have from company_tickers*.json)
    const knownCiks = new Set([...secMap.values()].flat().map(e => e.cik));

    console.log(`\nPhase D step 1: Collecting banking CIKs from EDGAR Atom browse…`);
    const allBankingCiks = await getBankingCiksFromEdgar();
    const newCiks = [...allBankingCiks].filter(cik => !knownCiks.has(cik));
    console.log(`  ${allBankingCiks.size} total banking CIKs, ${newCiks.length} new (not in secMap).`);

    if (newCiks.length > 0) {
      // Fetch submissions for new CIKs with batched concurrency (≤10 req/sec per SEC guidelines)
      // Batch size 3, 400ms between batches ≈ 7.5 req/sec
      console.log(`Phase D step 2: Fetching submissions for ${newCiks.length} new CIKs…`);
      const BATCH = 3;
      let fetched = 0;
      const newEntries = []; // { cik, ticker, title, key } — only entries with tickers
      for (let i = 0; i < newCiks.length; i += BATCH) {
        const batch = newCiks.slice(i, i + BATCH);
        await Promise.all(batch.map(async cik => {
          try {
            const sub  = await fetchJson(`${SEC_BASE}/submissions/CIK${cik}.json`);
            const name = (sub.name ?? '').trim();
            const tickers = sub.tickers ?? [];
            if (name && tickers.length > 0) {
              const key = normalize(name);
              const entry = { cik, ticker: tickers[0], title: name, key };
              newEntries.push(entry);
              if (!secMap.has(key)) secMap.set(key, []);
              if (!secMap.get(key).some(e => e.cik === cik)) {
                secMap.get(key).push(entry);
              }
            }
            fetched++;
          } catch { fetched++; }
        }));
        await sleep(400);
        if ((i / BATCH + 1) % 50 === 0 || i + BATCH >= newCiks.length) {
          process.stdout.write(`  ${fetched}/${newCiks.length} fetched, ${newEntries.length} have tickers\r`);
        }
      }
      process.stdout.write('\n');
      console.log(`  ${newEntries.length} new banking companies with tickers added to lookup.`);

      // Phase D step 3: match unresolved FDIC names against ONLY the new entries.
      // (All original secMap entries were already checked in Phase A — no need to rescan them.)
      console.log(`Phase D step 3: Matching ${names.filter(n=>!bhcMap.get(n)).length} unresolved names against ${newEntries.length} new entries…`);
      const stillMissing = names.filter(n => !bhcMap.get(n));
      let dHit = 0;
      for (const namehcr of stillMissing) {
        const key = normalize(namehcr);
        // Exact key match first (O(1))
        if (secMap.has(key)) {
          const match = secMap.get(key).find(c => c.ticker);
          // Only count if this is a NEW entry (not one from Phase A's original secMap)
          const isNew = newEntries.some(e => e.key === key);
          if (match && isNew) { bhcMap.set(namehcr, { cik: match.cik, ticker: match.ticker }); dHit++; continue; }
        }
        // Fuzzy match against new entries only
        for (const entry of newEntries) {
          if (nameMatch(namehcr, entry.title)) {
            bhcMap.set(namehcr, { cik: entry.cik, ticker: entry.ticker }); dHit++; break;
          }
        }
      }
      edgarHit = dHit;
      console.log(`  ${edgarHit} additional FDIC names matched via Phase D.`);
    }
  }

  const totalHit  = directHit + edgarHit;
  const finalMiss = miss - edgarHit;
  console.log(`\nBHC lookup: ${directHit} direct + ${edgarHit} EDGAR SIC = ${totalHit} total matched, ${finalMiss} unresolved.`);

  // Step 4: Update DB — reconnect fresh (API phases can take 10+ min, connection would time out)
  console.log('Reconnecting for DB writes…');
  const client = new Client({ connectionString: getUrl() });
  await client.connect();
  console.log('Connected. Updating DB…');
  let updated = 0;
  for (const item of fdicItems) {
    const d = item.data ?? item;
    const cert    = String(d.CERT ?? '');
    const rawHcr  = (d.NAMEHCR ?? '').trim();
    const rawName = (d.NAME    ?? '').trim();
    const k = rawHcr || rawName;
    if (!cert || !k) continue;

    const resolved = bhcMap.get(k);
    if (resolved) {
      await client.query(
        `UPDATE institutions SET bhc_name = $1, bhc_cik = $2, bhc_ticker = $3 WHERE fdic_cert = $4`,
        [rawHcr || rawName, resolved.cik, resolved.ticker, cert],
      );
      updated++;
    } else if (rawHcr) {
      await client.query(
        `UPDATE institutions SET bhc_name = $1 WHERE fdic_cert = $2`,
        [rawHcr, cert],
      );
    }
  }

  console.log(`\nDone. ${updated.toLocaleString()} institutions linked to a ticker.`);
  console.log(`BHC lookup: ${directHit} direct, ${edgarHit} via EDGAR SIC browse, ${finalMiss} unresolved.`);

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

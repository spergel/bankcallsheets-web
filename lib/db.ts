import { neon } from '@neondatabase/serverless';
import { Client } from 'pg';

function cleanUrl(): string {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL is not set');
  const u = new URL(raw);
  u.searchParams.delete('channel_binding');
  return u.toString();
}

function sql() {
  return neon(cleanUrl());
}

// For parameterized dynamic queries — neon v1 only supports tagged templates.
// pg works fine against Neon's pooler in Node.js runtime.
async function pgQuery(query: string, values: unknown[]): Promise<Record<string, unknown>[]> {
  const client = new Client({ connectionString: cleanUrl() });
  await client.connect();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { rows } = await client.query(query, values as any[]);
    return rows;
  } finally {
    await client.end().catch(() => {});
  }
}

export type IndexRow = {
  idrssd:           string;
  name:             string;
  state:            string;
  city:             string;
  zip:              string;
  address:          string;
  fdic_cert:        string;
  aba_routing:      string;
  filing_type:      string;
  latest_period:    string;
  total_assets:     string;
  total_deposits:   string;
  total_equity:     string;
  net_income:       string;
  past_due_30_89:   string;
  past_due_90_plus: string;
  roa:              string;
  roe:              string;
  nim:              string;
  efficiency_ratio: string;
  ltd_ratio:        string;
  npl_ratio:        string;
  coverage_ratio:   string;
  gross_loans:      string;
  securities:       string;
  oreo:             string;
  alll:             string;
  provision:        string;
  interest_income:  string;
  nonint_income:    string;
  loan_to_asset:    string;
  // FDIC-sourced
  tier1_ratio:         string;
  total_capital_ratio: string;
  leverage_ratio:      string;
  cre_loans:           string;
  construction_loans:  string;
  ci_loans:            string;
  residential_loans:   string;
  consumer_loans:      string;
  nco_rate:            string;
  // SEC/market data
  bhc_name:    string;
  bhc_cik:     string;
  bhc_ticker:  string;
  shares_out:  string;
  eps_diluted: string;
  div_per_share: string;
  tbv_per_share: string;
  market_cap:  string;
  stock_price: string;
  pe_ratio:    string;
  pb_ratio:    string;
  div_yield:   string;
  subsidiary_count: string;
};

function toRow(r: Record<string, unknown>): IndexRow {
  return {
    idrssd:           String(r.idrssd           ?? ''),
    name:             String(r.name             ?? ''),
    state:            String(r.state            ?? ''),
    city:             String(r.city             ?? ''),
    zip:              String(r.zip              ?? ''),
    address:          String(r.address          ?? ''),
    fdic_cert:        String(r.fdic_cert        ?? ''),
    aba_routing:      String(r.aba_routing      ?? ''),
    filing_type:      String(r.filing_type      ?? ''),
    latest_period:    String(r.latest_period    ?? ''),
    total_assets:     r.total_assets     != null ? String(r.total_assets)     : '',
    total_deposits:   r.total_deposits   != null ? String(r.total_deposits)   : '',
    total_equity:     r.total_equity     != null ? String(r.total_equity)     : '',
    net_income:       r.net_income       != null ? String(r.net_income)       : '',
    past_due_30_89:   r.past_due_30_89   != null ? String(r.past_due_30_89)   : '',
    past_due_90_plus: r.past_due_90_plus != null ? String(r.past_due_90_plus) : '',
    roa:              r.roa              != null ? String(r.roa)              : '',
    roe:              r.roe              != null ? String(r.roe)              : '',
    nim:              r.nim              != null ? String(r.nim)              : '',
    efficiency_ratio: r.efficiency_ratio != null ? String(r.efficiency_ratio) : '',
    ltd_ratio:        r.ltd_ratio        != null ? String(r.ltd_ratio)        : '',
    npl_ratio:        r.npl_ratio        != null ? String(r.npl_ratio)        : '',
    coverage_ratio:   r.coverage_ratio   != null ? String(r.coverage_ratio)   : '',
    gross_loans:      r.gross_loans      != null ? String(r.gross_loans)      : '',
    securities:       r.securities       != null ? String(r.securities)       : '',
    oreo:             r.oreo             != null ? String(r.oreo)             : '',
    alll:             r.alll             != null ? String(r.alll)             : '',
    provision:        r.provision        != null ? String(r.provision)        : '',
    interest_income:  r.interest_income  != null ? String(r.interest_income)  : '',
    nonint_income:    r.nonint_income    != null ? String(r.nonint_income)    : '',
    loan_to_asset:    r.loan_to_asset    != null ? String(r.loan_to_asset)    : '',
    tier1_ratio:         r.tier1_ratio         != null ? String(r.tier1_ratio)         : '',
    total_capital_ratio: r.total_capital_ratio != null ? String(r.total_capital_ratio) : '',
    leverage_ratio:      r.leverage_ratio      != null ? String(r.leverage_ratio)      : '',
    cre_loans:           r.cre_loans           != null ? String(r.cre_loans)           : '',
    construction_loans:  r.construction_loans  != null ? String(r.construction_loans)  : '',
    ci_loans:            r.ci_loans            != null ? String(r.ci_loans)            : '',
    residential_loans:   r.residential_loans   != null ? String(r.residential_loans)   : '',
    consumer_loans:      r.consumer_loans      != null ? String(r.consumer_loans)      : '',
    nco_rate:            r.nco_rate            != null ? String(r.nco_rate)            : '',
    bhc_name:    String(r.bhc_name    ?? ''),
    bhc_cik:     String(r.bhc_cik     ?? ''),
    bhc_ticker:  String(r.bhc_ticker  ?? ''),
    shares_out:  r.shares_out  != null ? String(r.shares_out)  : '',
    eps_diluted: r.eps_diluted != null ? String(r.eps_diluted) : '',
    div_per_share: r.div_per_share != null ? String(r.div_per_share) : '',
    tbv_per_share: r.tbv_per_share != null ? String(r.tbv_per_share) : '',
    market_cap:  r.market_cap  != null ? String(r.market_cap)  : '',
    stock_price: r.stock_price != null ? String(r.stock_price) : '',
    pe_ratio:    r.pe_ratio    != null ? String(r.pe_ratio)    : '',
    pb_ratio:    r.pb_ratio    != null ? String(r.pb_ratio)    : '',
    div_yield:   r.div_yield   != null ? String(r.div_yield)   : '',
    subsidiary_count: r.subsidiary_count != null ? String(r.subsidiary_count) : '',
  };
}

export async function getLabels(): Promise<Record<string, string>> {
  const db = sql();
  const rows = await db`SELECT code, label FROM labels`;
  const map: Record<string, string> = {};
  for (const r of rows) if (r.code) map[r.code] = r.label ?? '';
  return map;
}

export async function getInstitution(idrssd: string | number): Promise<IndexRow | null> {
  const db = sql();
  const rows = await db`SELECT * FROM institutions WHERE idrssd = ${String(idrssd)} LIMIT 1`;
  return rows.length > 0 ? toRow(rows[0] as Record<string, unknown>) : null;
}

export async function getBankHistory(idrssd: string | number): Promise<Record<string, string>[]> {
  const db = sql();
  const rows = await db`
    SELECT period_end_date::text, data
    FROM financials
    WHERE idrssd = ${String(idrssd)}
    ORDER BY period_end_date ASC
  `;
  return rows.map(r => ({
    period_end_date: String(r.period_end_date ?? ''),
    ...(r.data as Record<string, string>),
  }));
}

export async function searchIndex(
  q: string,
  state: string,
  page: number,
  limit = 25,
): Promise<{ results: IndexRow[]; total: number }> {
  if (!q && !state) return { results: [], total: 0 };
  const offset = (page - 1) * limit;

  // Build dynamic WHERE conditions
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (q) {
    params.push(`%${q}%`);
    conditions.push(`(name ILIKE $${params.length} OR fdic_cert = $${params.length} OR aba_routing = $${params.length})`);
    // Re-use same param index for all three comparisons - need separate params
    params.pop();
    params.push(`%${q}%`, q, q);
    const n = params.length;
    conditions[conditions.length - 1] = `(name ILIKE $${n - 2} OR fdic_cert = $${n - 1} OR aba_routing = $${n})`;
  }
  if (state) {
    params.push(state);
    conditions.push(`state = $${params.length}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(limit, offset);
  const limitIdx = params.length - 1;
  const offsetIdx = params.length;

  const query = `
    SELECT *, COUNT(*) OVER() AS total_count
    FROM institutions
    ${where}
    ORDER BY total_assets DESC NULLS LAST
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `;

  const rows = await pgQuery(query, params) as (Record<string, unknown> & { total_count: string })[];
  const total = rows.length > 0 ? parseInt(String(rows[0].total_count), 10) : 0;
  return { results: rows.map(toRow), total };
}

export type SortField = 'total_assets' | 'total_deposits' | 'total_equity' | 'net_income' | 'equity_ratio'
  | 'roa' | 'roe' | 'nim' | 'efficiency_ratio' | 'ltd_ratio' | 'npl_ratio' | 'coverage_ratio'
  | 'gross_loans' | 'securities' | 'oreo' | 'alll' | 'provision' | 'interest_income' | 'nonint_income' | 'loan_to_asset'
  | 'tier1_ratio' | 'total_capital_ratio' | 'leverage_ratio'
  | 'cre_loans' | 'construction_loans' | 'ci_loans' | 'residential_loans' | 'consumer_loans' | 'nco_rate'
  | 'market_cap' | 'stock_price' | 'pe_ratio' | 'pb_ratio' | 'div_yield' | 'tbv_per_share' | 'eps_diluted';

const SIZE_BUCKETS: Record<string, [number, number | null]> = {
  nano:      [0,            100_000],
  community: [0,          1_000_000],
  regional:  [1_000_000,  10_000_000],
  large:     [10_000_000, 100_000_000],
  mega:      [100_000_000, null],
};

const SORT_COLUMN: Record<SortField, string> = {
  total_assets:     'total_assets',
  total_deposits:   'total_deposits',
  total_equity:     'total_equity',
  net_income:       'net_income',
  equity_ratio:     'CASE WHEN total_assets > 0 THEN total_equity::float / total_assets ELSE 0 END',
  roa:              'roa',
  roe:              'roe',
  nim:              'nim',
  efficiency_ratio: 'efficiency_ratio',
  ltd_ratio:        'ltd_ratio',
  npl_ratio:        'npl_ratio',
  coverage_ratio:   'coverage_ratio',
  gross_loans:      'gross_loans',
  securities:       'securities',
  oreo:             'oreo',
  alll:             'alll',
  provision:        'provision',
  interest_income:  'interest_income',
  nonint_income:    'nonint_income',
  loan_to_asset:    'loan_to_asset',
  tier1_ratio:         'tier1_ratio',
  total_capital_ratio: 'total_capital_ratio',
  leverage_ratio:      'leverage_ratio',
  cre_loans:           'cre_loans',
  construction_loans:  'construction_loans',
  ci_loans:            'ci_loans',
  residential_loans:   'residential_loans',
  consumer_loans:      'consumer_loans',
  nco_rate:            'nco_rate',
  market_cap:   'market_cap',
  stock_price:  'stock_price',
  pe_ratio:     'pe_ratio',
  pb_ratio:     'pb_ratio',
  div_yield:    'div_yield',
  tbv_per_share:'tbv_per_share',
  eps_diluted:  'eps_diluted',
};

export async function advancedSearch(params: {
  q: string;
  state: string;
  city: string;
  filingType: string;
  size: string;
  minAssets: string;
  maxAssets: string;
  minEquityRatio: string;
  profitableOnly: string;
  publicOnly: string;
  dedupeByBhc?: boolean;
  minRoa: string;
  maxEfficiency: string;
  minNim: string;
  maxNpl: string;
  sort: SortField;
  sortDir: 'asc' | 'desc';
  page: number;
  limit?: number;
}): Promise<{ results: IndexRow[]; total: number }> {
  const limit  = params.limit ?? 50;
  const offset = (params.page - 1) * limit;

  const conditions: string[] = [];
  const values: unknown[] = [];

  function addParam(v: unknown) { values.push(v); return `$${values.length}`; }

  if (params.q) {
    const p = `%${params.q}%`;
    conditions.push(`(name ILIKE ${addParam(p)} OR fdic_cert = ${addParam(params.q)} OR aba_routing = ${addParam(params.q)} OR idrssd = ${addParam(params.q)} OR zip = ${addParam(params.q)} OR city ILIKE ${addParam(p)})`);
  }
  if (params.state)      conditions.push(`state = ${addParam(params.state)}`);
  if (params.city)       conditions.push(`city ILIKE ${addParam(`%${params.city}%`)}`);
  if (params.filingType) conditions.push(`filing_type = ${addParam(params.filingType)}`);

  const bucket = params.size ? SIZE_BUCKETS[params.size] : null;
  const minA = params.minAssets ? Number(params.minAssets) : (bucket ? bucket[0] : null);
  const maxA = params.maxAssets ? Number(params.maxAssets) : (bucket ? bucket[1] : null);
  if (minA != null) conditions.push(`total_assets >= ${addParam(minA)}`);
  if (maxA != null) conditions.push(`total_assets <= ${addParam(maxA)}`);

  if (params.profitableOnly === '1') conditions.push(`net_income > 0`);
  if (params.publicOnly     === '1') conditions.push(`bhc_ticker IS NOT NULL`);

  if (params.minRoa)        conditions.push(`roa              >= ${addParam(Number(params.minRoa)        / 100)}`);
  if (params.maxEfficiency) conditions.push(`efficiency_ratio <= ${addParam(Number(params.maxEfficiency) / 100)}`);
  if (params.minNim)        conditions.push(`nim              >= ${addParam(Number(params.minNim)        / 100)}`);
  if (params.maxNpl)        conditions.push(`npl_ratio        <= ${addParam(Number(params.maxNpl)        / 100)}`);

  if (params.minEquityRatio) {
    const pct = Number(params.minEquityRatio) / 100;
    conditions.push(`total_assets > 0 AND total_equity::float / total_assets >= ${addParam(pct)}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const orderCol = SORT_COLUMN[params.sort] ?? 'total_assets';
  const dir = params.sortDir === 'asc' ? 'ASC' : 'DESC';

  values.push(limit, offset);
  const lIdx = values.length - 1;
  const oIdx = values.length;

  const query = params.dedupeByBhc
    ? `
      SELECT *, COUNT(*) OVER() AS total_count
      FROM (
        SELECT *,
          COUNT(*) OVER(PARTITION BY COALESCE(bhc_cik, idrssd::text)) AS subsidiary_count,
          ROW_NUMBER() OVER(PARTITION BY COALESCE(bhc_cik, idrssd::text) ORDER BY total_assets DESC NULLS LAST) AS rn
        FROM institutions
        ${where}
      ) t
      WHERE rn = 1
      ORDER BY ${orderCol} ${dir} NULLS LAST
      LIMIT $${lIdx} OFFSET $${oIdx}
    `
    : `
      SELECT *, COUNT(*) OVER() AS total_count
      FROM institutions
      ${where}
      ORDER BY ${orderCol} ${dir} NULLS LAST
      LIMIT $${lIdx} OFFSET $${oIdx}
    `;

  const rows = await pgQuery(query, values) as (Record<string, unknown> & { total_count: string })[];
  const total = rows.length > 0 ? parseInt(String(rows[0].total_count), 10) : 0;
  return { results: rows.map(toRow), total };
}

export async function browseIndex(
  state: string,
  page: number,
  limit = 50,
  sort: SortField = 'total_assets',
  sortDir: 'asc' | 'desc' = 'desc',
): Promise<{ results: IndexRow[]; total: number }> {
  const offset = (page - 1) * limit;
  const orderCol = SORT_COLUMN[sort] ?? 'total_assets';
  const dir = sortDir === 'asc' ? 'ASC' : 'DESC';

  const values: unknown[] = [];
  function addParam(v: unknown) { values.push(v); return `$${values.length}`; }

  const where = state ? `WHERE state = ${addParam(state)}` : '';
  values.push(limit, offset);
  const lIdx = values.length - 1;
  const oIdx = values.length;

  const query = `
    SELECT *, COUNT(*) OVER() AS total_count
    FROM institutions
    ${where}
    ORDER BY ${orderCol} ${dir} NULLS LAST
    LIMIT $${lIdx} OFFSET $${oIdx}
  `;

  const rows = await pgQuery(query, values) as (Record<string, unknown> & { total_count: string })[];
  const total = rows.length > 0 ? parseInt(String(rows[0].total_count), 10) : 0;
  return { results: rows.map(toRow), total };
}

export async function getStateCounts(): Promise<Record<string, number>> {
  const db = sql();
  const rows = await db`SELECT state, COUNT(*)::int AS count FROM institutions WHERE state IS NOT NULL GROUP BY state`;
  const counts: Record<string, number> = {};
  for (const r of rows) if (r.state) counts[String(r.state)] = Number(r.count);
  return counts;
}

export async function getPeers(idrssd: string | number, assetSize: number, limit = 25): Promise<IndexRow[]> {
  const db = sql();
  const lo = Math.floor(assetSize * 0.33);
  const hi = Math.ceil(assetSize * 3);
  const rows = await db`
    SELECT *
    FROM institutions
    WHERE idrssd != ${String(idrssd)}
      AND total_assets BETWEEN ${lo} AND ${hi}
    ORDER BY ABS(total_assets - ${assetSize}) ASC
    LIMIT ${limit}
  `;
  return (rows as Record<string, unknown>[]).map(toRow);
}

export type BhcFinancialRow = {
  period_end:          string;
  interest_income:     number | null;
  interest_expense:    number | null;
  net_interest_income: number | null;
  noninterest_income:  number | null;
  noninterest_expense: number | null;
  provision:           number | null;
  net_income:          number | null;
  eps_diluted:         number | null;
  total_assets:        number | null;
  total_deposits:      number | null;
  total_equity:        number | null;
  goodwill:            number | null;
  net_loans:           number | null;
  shares_out:          number | null;
  tbv_per_share:       number | null;
};

export async function getBhcFinancials(cik: string): Promise<BhcFinancialRow[]> {
  if (!cik) return [];
  const rows = await pgQuery(
    `SELECT period_end::text,
            interest_income, interest_expense, net_interest_income,
            noninterest_income, noninterest_expense, provision,
            net_income, eps_diluted,
            total_assets, total_deposits, total_equity,
            goodwill, net_loans, shares_out, tbv_per_share
     FROM bhc_financials
     WHERE bhc_cik = $1
     ORDER BY period_end ASC`,
    [cik],
  );
  return rows.map(r => ({
    period_end:          String(r.period_end ?? ''),
    interest_income:     r.interest_income     != null ? Number(r.interest_income)     : null,
    interest_expense:    r.interest_expense    != null ? Number(r.interest_expense)    : null,
    net_interest_income: r.net_interest_income != null ? Number(r.net_interest_income) : null,
    noninterest_income:  r.noninterest_income  != null ? Number(r.noninterest_income)  : null,
    noninterest_expense: r.noninterest_expense != null ? Number(r.noninterest_expense) : null,
    provision:           r.provision           != null ? Number(r.provision)           : null,
    net_income:          r.net_income          != null ? Number(r.net_income)          : null,
    eps_diluted:         r.eps_diluted         != null ? Number(r.eps_diluted)         : null,
    total_assets:        r.total_assets        != null ? Number(r.total_assets)        : null,
    total_deposits:      r.total_deposits      != null ? Number(r.total_deposits)      : null,
    total_equity:        r.total_equity        != null ? Number(r.total_equity)        : null,
    goodwill:            r.goodwill            != null ? Number(r.goodwill)            : null,
    net_loans:           r.net_loans           != null ? Number(r.net_loans)           : null,
    shares_out:          r.shares_out          != null ? Number(r.shares_out)          : null,
    tbv_per_share:       r.tbv_per_share       != null ? Number(r.tbv_per_share)       : null,
  }));
}

export type HomeLeaderRow = {
  idrssd: string;
  name: string;
  state: string;
  city: string;
  total_assets: number;
  total_deposits: number;
  net_income: number | null;
  roa: number | null;
  bhc_ticker: string | null;
  market_cap: number | null;
  pe_ratio: number | null;
};

export async function getHomeData(): Promise<{
  institutionCount: number;
  latestPeriod: string;
  totalAssetsTrillion: number;
  largest: HomeLeaderRow[];
  mostProfitable: HomeLeaderRow[];
  publicCount: number;
}> {
  const db = sql();
  const [countRow] = await db`SELECT COUNT(*)::int AS n FROM institutions`;
  const [latestRow] = await db`SELECT MAX(latest_period)::text AS lp FROM institutions`;
  const [assetsRow] = await db`SELECT SUM(total_assets)::bigint AS ta FROM institutions WHERE total_assets IS NOT NULL`;

  const largestRows = await db`
    SELECT idrssd, name, state, city, total_assets, total_deposits, net_income, roa,
           bhc_ticker, market_cap, pe_ratio
    FROM institutions
    WHERE total_assets IS NOT NULL
    ORDER BY total_assets DESC NULLS LAST
    LIMIT 15
  `;

  const profitableRows = await db`
    SELECT idrssd, name, state, city, total_assets, total_deposits, net_income, roa,
           bhc_ticker, market_cap, pe_ratio
    FROM institutions
    WHERE total_assets > 1000000 AND roa IS NOT NULL AND net_income > 0
    ORDER BY roa DESC NULLS LAST
    LIMIT 15
  `;

  const [pubRow] = await db`SELECT COUNT(DISTINCT bhc_ticker)::int AS n FROM institutions WHERE bhc_ticker IS NOT NULL`;

  function toLeader(r: Record<string, unknown>): HomeLeaderRow {
    return {
      idrssd:        String(r.idrssd ?? ''),
      name:          String(r.name ?? ''),
      state:         String(r.state ?? ''),
      city:          String(r.city ?? ''),
      total_assets:  Number(r.total_assets ?? 0),
      total_deposits:Number(r.total_deposits ?? 0),
      net_income:    r.net_income != null ? Number(r.net_income) : null,
      roa:           r.roa != null ? Number(r.roa) : null,
      bhc_ticker:    r.bhc_ticker ? String(r.bhc_ticker) : null,
      market_cap:    r.market_cap != null ? Number(r.market_cap) : null,
      pe_ratio:      r.pe_ratio != null ? Number(r.pe_ratio) : null,
    };
  }

  return {
    institutionCount:    Number(countRow?.n ?? 0),
    latestPeriod:        String(latestRow?.lp ?? ''),
    totalAssetsTrillion: Number(assetsRow?.ta ?? 0) / 1_000_000_000, // $000s → $T
    largest:             (largestRows as Record<string, unknown>[]).map(toLeader),
    mostProfitable:      (profitableRows as Record<string, unknown>[]).map(toLeader),
    publicCount:         Number(pubRow?.n ?? 0),
  };
}

export async function getStats(): Promise<{
  institution_count: number;
  latest_period: string;
  top_banks: { idrssd: string; name: string; state: string; total_assets: number }[];
  years_covered: number;
}> {
  const db = sql();
  const [countRow] = await db`SELECT COUNT(*)::int AS n FROM institutions`;
  const [latestRow] = await db`SELECT MAX(latest_period) AS lp FROM institutions`;
  const topRows = await db`
    SELECT idrssd, name, state, total_assets
    FROM institutions
    WHERE total_assets IS NOT NULL
    ORDER BY total_assets DESC NULLS LAST
    LIMIT 10
  `;

  return {
    institution_count: Number(countRow?.n ?? 0),
    latest_period:     String(latestRow?.lp ?? ''),
    top_banks: (topRows as Record<string, unknown>[]).map(r => ({
      idrssd:       String(r.idrssd),
      name:         String(r.name),
      state:        String(r.state ?? ''),
      total_assets: Number(r.total_assets ?? 0),
    })),
    years_covered: 25,
  };
}

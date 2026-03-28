import { neon } from '@neondatabase/serverless';

function sql() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  return neon(process.env.DATABASE_URL);
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
  const db = sql();
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = await (db as any)(query, ...params) as (Record<string, unknown> & { total_count: string })[];
  const total = rows.length > 0 ? parseInt(String(rows[0].total_count), 10) : 0;
  return { results: rows.map(toRow), total };
}

export type SortField = 'total_assets' | 'total_deposits' | 'total_equity' | 'net_income' | 'equity_ratio'
  | 'roa' | 'roe' | 'nim' | 'efficiency_ratio' | 'ltd_ratio' | 'npl_ratio' | 'coverage_ratio';

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
};

export async function advancedSearch(params: {
  q: string;
  state: string;
  size: string;
  minAssets: string;
  maxAssets: string;
  minEquityRatio: string;
  profitableOnly: string;
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
  const db = sql();

  const conditions: string[] = [];
  const values: unknown[] = [];

  function addParam(v: unknown) { values.push(v); return `$${values.length}`; }

  if (params.q) {
    const p = `%${params.q}%`;
    conditions.push(`(name ILIKE ${addParam(p)} OR fdic_cert = ${addParam(params.q)} OR aba_routing = ${addParam(params.q)})`);
  }
  if (params.state)  conditions.push(`state = ${addParam(params.state)}`);

  const bucket = params.size ? SIZE_BUCKETS[params.size] : null;
  const minA = params.minAssets ? Number(params.minAssets) : (bucket ? bucket[0] : null);
  const maxA = params.maxAssets ? Number(params.maxAssets) : (bucket ? bucket[1] : null);
  if (minA != null) conditions.push(`total_assets >= ${addParam(minA)}`);
  if (maxA != null) conditions.push(`total_assets <= ${addParam(maxA)}`);

  if (params.profitableOnly === '1') conditions.push(`net_income > 0`);

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

  const query = `
    SELECT *, COUNT(*) OVER() AS total_count
    FROM institutions
    ${where}
    ORDER BY ${orderCol} ${dir} NULLS LAST
    LIMIT $${lIdx} OFFSET $${oIdx}
  `;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = await (db as any)(query, ...values) as (Record<string, unknown> & { total_count: string })[];
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
  const db = sql();
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = await (db as any)(query, ...values) as (Record<string, unknown> & { total_count: string })[];
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

/**
 * FDIC BankFind API client — free, no auth required.
 * Docs: https://banks.data.fdic.gov/docs/
 *
 * Dollar values in API responses are in thousands (matching FFIEC native units).
 * Capital ratios are in percentage points (12.5 = 12.5%).
 */

const FDIC_BASE = 'https://banks.data.fdic.gov/api';

export type FdicInstitution = {
  cert:      string;
  namehcr:   string;   // holding company name
  cbsanm:    string;   // metro/micro area name
  estymd:    string;   // established date YYYYMMDD
  chrtagnt:  string;   // charter agent: OCC | STATE | OTS | NCUA
  charter:   string;   // charter class code
  offdom:    number;   // number of domestic offices/branches
  instcat:   number;   // institution category
  stname:    string;   // full state name
  rssdid:    string;   // RSSD ID (same as IDRSSD)
};

export type FdicFinancials = {
  repdte:     string;        // YYYYMMDD
  tier1_ratio: number | null; // Tier 1 RBC ratio (%)
  total_capital_ratio: number | null; // Total RBC ratio (%)
  leverage_ratio: number | null;      // Tier 1 leverage ratio (%)
  cet1_ratio:  number | null;
  lnre:        number;  // total real estate loans ($000s)
  lnreres:     number;  // 1-4 family residential ($000s)
  lnrenres:    number;  // nonfarm nonresidential / CRE ($000s)
  lnrecons:    number;  // construction & land ($000s)
  lnremult:    number;  // multifamily ($000s)
  lnci:        number;  // C&I loans ($000s)
  lncon:       number;  // consumer/individual loans ($000s)
  lnlsnet:     number;  // net loans & leases ($000s)
  lnatres:     number;  // ALLL ($000s)
  netcharge:   number;  // net charge-offs ($000s)
  asset:       number;
  dep:         number;
  eq:          number;
  netinc:      number;
  intinc:      number;
  nonii:       number;
};

function n(v: unknown): number { return Number(v ?? 0); }
function nn(v: unknown): number | null { return v != null && v !== '' ? Number(v) : null; }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapFinancials(d: Record<string, any>): FdicFinancials {
  return {
    repdte:              d.REPDTE ?? '',
    tier1_ratio:         nn(d.RBC1RWAJR),
    total_capital_ratio: nn(d.RBCRWAJ),
    leverage_ratio:      nn(d.LEIRATE),
    cet1_ratio:          nn(d.RBC1CER),
    lnre:    n(d.LNRE),
    lnreres: n(d.LNRERES),
    lnrenres:n(d.LNRENRES),
    lnrecons:n(d.LNRECONS),
    lnremult:n(d.LNREMULT),
    lnci:    n(d.LNCI),
    lncon:   n(d.LNCON),
    lnlsnet: n(d.LNLSNET),
    lnatres: n(d.LNATRES),
    netcharge:n(d.NETCHARGE),
    asset:   n(d.ASSET),
    dep:     n(d.DEP),
    eq:      n(d.EQ),
    netinc:  n(d.NETINC),
    intinc:  n(d.INTINC),
    nonii:   n(d.NONII),
  };
}

export async function getFdicInstitution(cert: string): Promise<FdicInstitution | null> {
  if (!cert || cert === 'null') return null;
  const fields = 'CERT,NAMEHCR,CBSANM,ESTYMD,CHRTAGNT,CHARTER,OFFDOM,INSTCAT,STNAME,RSSDID';
  const url = `${FDIC_BASE}/institutions?filters=CERT%3A${encodeURIComponent(cert)}&fields=${fields}&limit=1`;
  try {
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) return null;
    const json = await res.json();
    const d = json?.data?.[0]?.data;
    if (!d) return null;
    return {
      cert:     String(d.CERT ?? ''),
      namehcr:  d.NAMEHCR ?? '',
      cbsanm:   d.CBSANM ?? '',
      estymd:   d.ESTYMD ?? '',
      chrtagnt: d.CHRTAGNT ?? '',
      charter:  d.CHARTER ?? '',
      offdom:   n(d.OFFDOM),
      instcat:  n(d.INSTCAT),
      stname:   d.STNAME ?? '',
      rssdid:   String(d.RSSDID ?? ''),
    };
  } catch {
    return null;
  }
}

/** Returns financials sorted newest-first. Limit 40 = ~10 years of quarterly data. */
export async function getFdicFinancials(cert: string, limit = 40): Promise<FdicFinancials[]> {
  if (!cert || cert === 'null') return [];
  const fields = 'REPDTE,ASSET,DEP,EQ,NETINC,INTINC,NONII,LNLSNET,LNRE,LNRERES,LNRENRES,LNRECONS,LNREMULT,LNCI,LNCON,LNATRES,NETCHARGE,RBC1RWAJR,RBCRWAJ,LEIRATE,RBC1CER';
  const url = `${FDIC_BASE}/financials?filters=CERT%3A${encodeURIComponent(cert)}&fields=${fields}&sort_by=REPDTE&sort_order=DESC&limit=${limit}`;
  try {
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) return [];
    const json = await res.json();
    if (!Array.isArray(json?.data)) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return json.data.map((item: any) => mapFinancials(item.data ?? item));
  } catch {
    return [];
  }
}

/** Human-readable charter agent label */
export function charterLabel(chrtagnt: string, charter: string): string {
  const a = (chrtagnt ?? '').toUpperCase();
  const c = (charter ?? '').toUpperCase();
  if (a === 'OCC') return 'OCC (National Bank)';
  if (a === 'FRB') return 'Federal Reserve';
  if (a === 'FDIC') return 'FDIC (State Non-Member)';
  if (a === 'NCUA') return 'NCUA (Credit Union)';
  if (c === 'SB' || c === 'SA') return 'OTS / State (Savings)';
  if (a === 'STATE' || a === 'ST') return 'State Chartered';
  return chrtagnt || charter || '—';
}

/** Parse YYYYMMDD or YYYY-MM-DD → 4-digit year string */
export function foundedYear(estymd: string): string {
  if (!estymd) return '—';
  return estymd.replace(/-/g, '').slice(0, 4);
}

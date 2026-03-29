import Link from "next/link";
import { advancedSearch, type SortField } from "@/lib/db";
import { formatDollars, formatPct } from "@/lib/format";
import type { IndexRow } from "@/lib/db";

export const runtime = 'nodejs';

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC","PR","VI","GU","AS","MP",
];

const SIZE_OPTIONS = [
  { value: "",          label: "Any size" },
  { value: "nano",      label: "< $100M (community)" },
  { value: "community", label: "< $1B" },
  { value: "regional",  label: "$1B – $10B (regional)" },
  { value: "large",     label: "$10B – $100B (large)" },
  { value: "mega",      label: "> $100B (mega)" },
];

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: "total_assets",     label: "Total Assets" },
  { value: "total_deposits",   label: "Total Deposits" },
  { value: "total_equity",     label: "Total Equity" },
  { value: "net_income",       label: "Net Income" },
  { value: "equity_ratio",     label: "Eq / Assets" },
  { value: "gross_loans",      label: "Gross Loans" },
  { value: "securities",       label: "Securities" },
  { value: "interest_income",  label: "Interest Income" },
  { value: "nonint_income",    label: "Fee Income" },
  { value: "provision",        label: "Provision" },
  { value: "oreo",             label: "OREO" },
  { value: "alll",             label: "ALLL" },
  { value: "loan_to_asset",    label: "Loan / Asset" },
  { value: "roa",              label: "ROA" },
  { value: "roe",              label: "ROE" },
  { value: "nim",              label: "NIM" },
  { value: "efficiency_ratio", label: "Efficiency Ratio" },
  { value: "ltd_ratio",        label: "LTD Ratio" },
  { value: "npl_ratio",        label: "NPL Ratio" },
  { value: "coverage_ratio",   label: "Coverage Ratio" },
];

const EQ_RATIO_OPTIONS = [
  { value: "",   label: "Any" },
  { value: "6",  label: "> 6%" },
  { value: "8",  label: "> 8%" },
  { value: "10", label: "> 10%" },
  { value: "12", label: "> 12%" },
  { value: "15", label: "> 15%" },
];

const ROA_OPTIONS = [
  { value: "",    label: "Any" },
  { value: "0.5", label: "> 0.5%" },
  { value: "1",   label: "> 1.0%" },
  { value: "1.5", label: "> 1.5%" },
  { value: "2",   label: "> 2.0%" },
];

const EFFICIENCY_OPTIONS = [
  { value: "",   label: "Any" },
  { value: "50", label: "< 50%" },
  { value: "60", label: "< 60%" },
  { value: "70", label: "< 70%" },
  { value: "80", label: "< 80%" },
];

const NIM_OPTIONS = [
  { value: "",  label: "Any" },
  { value: "2", label: "> 2%" },
  { value: "3", label: "> 3%" },
  { value: "4", label: "> 4%" },
  { value: "5", label: "> 5%" },
];

const NPL_OPTIONS = [
  { value: "",  label: "Any" },
  { value: "1", label: "< 1%" },
  { value: "2", label: "< 2%" },
  { value: "5", label: "< 5%" },
];

// ── Column picker ────────────────────────────────────────────────────────────
type ColDef = { id: string; label: string; sort: SortField; right: boolean };
const COLS_AVAILABLE: ColDef[] = [
  { id: "total_assets",     label: "Assets",        sort: "total_assets",     right: true },
  { id: "total_deposits",   label: "Deposits",      sort: "total_deposits",   right: true },
  { id: "total_equity",     label: "Equity",        sort: "total_equity",     right: true },
  { id: "eq_ratio",         label: "Eq/Assets",     sort: "equity_ratio",     right: true },
  { id: "net_income",       label: "Net Income",    sort: "net_income",       right: true },
  { id: "gross_loans",      label: "Gross Loans",   sort: "gross_loans",      right: true },
  { id: "securities",       label: "Securities",    sort: "securities",       right: true },
  { id: "interest_income",  label: "Interest Inc.", sort: "interest_income",  right: true },
  { id: "nonint_income",    label: "Fee Income",    sort: "nonint_income",    right: true },
  { id: "provision",        label: "Provision",     sort: "provision",        right: true },
  { id: "oreo",             label: "OREO",          sort: "oreo",             right: true },
  { id: "alll",             label: "ALLL",          sort: "alll",             right: true },
  { id: "loan_to_asset",    label: "Loan/Asset",    sort: "loan_to_asset",    right: true },
  { id: "roa",              label: "ROA",           sort: "roa",              right: true },
  { id: "roe",              label: "ROE",           sort: "roe",              right: true },
  { id: "nim",              label: "NIM",           sort: "nim",              right: true },
  { id: "efficiency_ratio", label: "Efficiency",    sort: "efficiency_ratio", right: true },
  { id: "ltd_ratio",        label: "LTD",           sort: "ltd_ratio",        right: true },
  { id: "npl_ratio",        label: "NPL Ratio",     sort: "npl_ratio",        right: true },
  { id: "coverage_ratio",   label: "Coverage",      sort: "coverage_ratio",   right: true },
];
const DEFAULT_COLS = ["total_assets", "total_deposits", "total_equity", "eq_ratio", "net_income"];

function colCell(id: string, r: IndexRow): React.ReactNode {
  if (id === "total_assets")   return r.total_assets   ? formatDollars(Number(r.total_assets))   : "—";
  if (id === "total_deposits") return r.total_deposits ? formatDollars(Number(r.total_deposits)) : "—";
  if (id === "total_equity")   return r.total_equity   ? formatDollars(Number(r.total_equity))   : "—";
  if (id === "net_income") {
    if (!r.net_income) return "—";
    const n = Number(r.net_income);
    return <span className={n < 0 ? "text-red-600" : ""}>{formatDollars(n)}</span>;
  }
  if (id === "eq_ratio") {
    const a = Number(r.total_assets), e = Number(r.total_equity);
    return a > 0 && r.total_equity ? `${((e / a) * 100).toFixed(1)}%` : "—";
  }
  if (id === "gross_loans")     return r.gross_loans     ? formatDollars(Number(r.gross_loans))     : "—";
  if (id === "securities")      return r.securities      ? formatDollars(Number(r.securities))      : "—";
  if (id === "interest_income") return r.interest_income ? formatDollars(Number(r.interest_income)) : "—";
  if (id === "nonint_income")   return r.nonint_income   ? formatDollars(Number(r.nonint_income))   : "—";
  if (id === "provision") {
    if (!r.provision) return "—";
    return formatDollars(Number(r.provision));
  }
  if (id === "oreo")            return r.oreo            ? formatDollars(Number(r.oreo))            : "—";
  if (id === "alll")            return r.alll            ? formatDollars(Number(r.alll))            : "—";
  if (id === "loan_to_asset")   return r.loan_to_asset   ? formatPct(Number(r.loan_to_asset), 1)    : "—";
  if (id === "roa")              return r.roa              ? formatPct(Number(r.roa), 2)              : "—";
  if (id === "roe")              return r.roe              ? formatPct(Number(r.roe), 1)              : "—";
  if (id === "nim")              return r.nim              ? formatPct(Number(r.nim), 2)              : "—";
  if (id === "efficiency_ratio") return r.efficiency_ratio ? formatPct(Number(r.efficiency_ratio), 1) : "—";
  if (id === "ltd_ratio")        return r.ltd_ratio        ? formatPct(Number(r.ltd_ratio), 1)        : "—";
  if (id === "npl_ratio")        return r.npl_ratio        ? formatPct(Number(r.npl_ratio), 2)        : "—";
  if (id === "coverage_ratio")   return r.coverage_ratio   ? formatPct(Number(r.coverage_ratio), 0)   : "—";
  return "—";
}

const LIMIT = 50;

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const p = await searchParams;

  const q               = p.q?.trim() ?? "";
  const state           = p.state?.trim().toUpperCase() ?? "";
  const city            = p.city?.trim() ?? "";
  const filingType      = p.filingType ?? "";
  const size            = p.size ?? "";
  const minAssets       = p.minAssets ?? "";
  const maxAssets       = p.maxAssets ?? "";
  const minEquityRatio  = p.minEqRatio ?? "";
  const profitableOnly  = p.profitable ?? "";
  const minRoa          = p.minRoa ?? "";
  const maxEfficiency   = p.maxEff ?? "";
  const minNim          = p.minNim ?? "";
  const maxNpl          = p.maxNpl ?? "";
  const sort            = (SORT_OPTIONS.find(o => o.value === p.sort)?.value ?? "total_assets") as SortField;
  const sortDir         = p.dir === "asc" ? "asc" : "desc";
  const page            = Math.max(1, parseInt(p.page ?? "1", 10));

  // Column picker
  const rawCols = p.cols ? p.cols.split(",").filter(c => COLS_AVAILABLE.some(d => d.id === c)) : null;
  const activeCols = rawCols ?? DEFAULT_COLS;

  const hasFilters = !!(q || state || city || filingType || size || minAssets || maxAssets || minEquityRatio || profitableOnly || minRoa || maxEfficiency || minNim || maxNpl);

  const { results, total } = await (async () => {
    if (!hasFilters) return { results: [], total: 0 };
    try {
      return await advancedSearch({ q, state, city, filingType, size, minAssets, maxAssets, minEquityRatio, profitableOnly, minRoa, maxEfficiency, minNim, maxNpl, sort, sortDir, page, limit: LIMIT });
    } catch (e) {
      console.error('[search] advancedSearch error:', e);
      return { results: [], total: 0 };
    }
  })();

  const totalPages = Math.ceil(total / LIMIT);

  function buildUrl(overrides: Record<string, string | number>) {
    const sp = new URLSearchParams();
    if (q)              sp.set("q", q);
    if (state)          sp.set("state", state);
    if (city)           sp.set("city", city);
    if (filingType)     sp.set("filingType", filingType);
    if (size)           sp.set("size", size);
    if (minAssets)      sp.set("minAssets", minAssets);
    if (maxAssets)      sp.set("maxAssets", maxAssets);
    if (minEquityRatio) sp.set("minEqRatio", minEquityRatio);
    if (profitableOnly) sp.set("profitable", profitableOnly);
    if (minRoa)         sp.set("minRoa", minRoa);
    if (maxEfficiency)  sp.set("maxEff", maxEfficiency);
    if (minNim)         sp.set("minNim", minNim);
    if (maxNpl)         sp.set("maxNpl", maxNpl);
    if (sort !== "total_assets") sp.set("sort", sort);
    if (sortDir !== "desc")      sp.set("dir", sortDir);
    sp.set("page", String(page));
    if (activeCols !== DEFAULT_COLS) sp.set("cols", activeCols.join(","));
    for (const [k, v] of Object.entries(overrides)) sp.set(k, String(v));
    return `/search?${sp.toString()}`;
  }

  function sortUrl(field: SortField) {
    const newDir = sort === field && sortDir === "desc" ? "asc" : "desc";
    return buildUrl({ sort: field, dir: newDir, page: 1 });
  }

  function sortIcon(field: SortField) {
    if (sort !== field) return <span className="text-white/30 ml-1">↕</span>;
    return <span className="ml-1">{sortDir === "desc" ? "↓" : "↑"}</span>;
  }

  function toggleColUrl(colId: string) {
    const next = activeCols.includes(colId)
      ? activeCols.filter(c => c !== colId)
      : [...activeCols, colId];
    return buildUrl({ cols: next.join(","), page: 1 });
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Filter panel */}
      <form method="GET" action="/search" className="bg-white border border-gray-200 rounded p-5 mb-6 space-y-4">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Advanced Search</div>

        {/* Row 1: name + city + state + filing type + submit */}
        <div className="flex flex-wrap gap-3">
          <input
            name="q"
            defaultValue={q}
            placeholder="Name, FDIC cert, ABA routing, ZIP, or IDRSSD…"
            className="flex-1 min-w-56 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#0a2342]"
          />
          <input
            name="city"
            defaultValue={city}
            placeholder="City…"
            className="w-36 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#0a2342]"
          />
          <select
            name="state"
            defaultValue={state}
            className="px-3 py-2 text-sm border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-[#0a2342]"
          >
            <option value="">All States</option>
            {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            name="filingType"
            defaultValue={filingType}
            className="px-3 py-2 text-sm border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-[#0a2342]"
          >
            <option value="">All types</option>
            <option value="051">FFIEC 051 — Community</option>
            <option value="041">FFIEC 041 — Domestic</option>
            <option value="031">FFIEC 031 — Large / Intl</option>
          </select>
          <button
            type="submit"
            className="px-6 py-2 bg-[#0a2342] text-white text-sm font-semibold rounded hover:bg-[#0d2d57] transition-colors"
          >
            Search
          </button>
          {hasFilters && (
            <Link href="/search" className="px-4 py-2 text-sm border border-gray-300 rounded bg-white hover:bg-gray-50 text-gray-500">
              Clear
            </Link>
          )}
        </div>

        {/* Row 2: size / sort / direction / equity ratio / profitable */}
        <div className="flex flex-wrap gap-3 pt-1 border-t border-gray-100">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Asset Size</label>
            <select name="size" defaultValue={size} className="px-3 py-2 text-sm border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-[#0a2342]">
              {SIZE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Sort By</label>
            <select name="sort" defaultValue={sort} className="px-3 py-2 text-sm border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-[#0a2342]">
              {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Direction</label>
            <select name="dir" defaultValue={sortDir} className="px-3 py-2 text-sm border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-[#0a2342]">
              <option value="desc">Highest first</option>
              <option value="asc">Lowest first</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Min Equity / Assets</label>
            <select name="minEqRatio" defaultValue={minEquityRatio} className="px-3 py-2 text-sm border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-[#0a2342]">
              {EQ_RATIO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1 justify-end">
            <label className="text-xs text-gray-500 invisible">Filter</label>
            <label className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded bg-white cursor-pointer select-none hover:bg-gray-50">
              <input
                type="checkbox"
                name="profitable"
                value="1"
                defaultChecked={profitableOnly === "1"}
                className="accent-[#0a2342]"
              />
              Profitable only
            </label>
          </div>
        </div>

        {/* Row 3: financial quality filters */}
        <div className="flex flex-wrap gap-3 pt-1 border-t border-gray-100">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Min ROA</label>
            <select name="minRoa" defaultValue={minRoa} className="px-3 py-2 text-sm border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-[#0a2342]">
              {ROA_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Max Efficiency Ratio</label>
            <select name="maxEff" defaultValue={maxEfficiency} className="px-3 py-2 text-sm border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-[#0a2342]">
              {EFFICIENCY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Min NIM</label>
            <select name="minNim" defaultValue={minNim} className="px-3 py-2 text-sm border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-[#0a2342]">
              {NIM_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Max NPL Ratio</label>
            <select name="maxNpl" defaultValue={maxNpl} className="px-3 py-2 text-sm border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-[#0a2342]">
              {NPL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        {/* Preserve cols param across form submissions */}
        {activeCols !== DEFAULT_COLS && (
          <input type="hidden" name="cols" value={activeCols.join(",")} />
        )}
      </form>

      {/* Results header */}
      {hasFilters && (
        <div className="flex items-baseline justify-between mb-3">
          <p className="text-sm text-gray-600">
            {total > 0
              ? <><strong className="text-[#0a2342]">{total.toLocaleString()}</strong> institution{total !== 1 ? "s" : ""} found</>
              : "No results matched your filters."}
          </p>
          {totalPages > 1 && (
            <span className="text-xs text-gray-400">Page {page} of {totalPages}</span>
          )}
        </div>
      )}

      {/* Column picker */}
      {(hasFilters || results.length > 0) && (
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          <span className="text-xs text-gray-400 mr-0.5">Columns:</span>
          {COLS_AVAILABLE.map(col => {
            const active = activeCols.includes(col.id);
            return (
              <Link
                key={col.id}
                href={toggleColUrl(col.id)}
                className={`px-2 py-0.5 text-xs rounded border transition-colors ${
                  active
                    ? "bg-[#0a2342] text-white border-[#0a2342]"
                    : "bg-white text-gray-500 border-gray-300 hover:border-gray-400 hover:text-gray-700"
                }`}
              >
                {col.label}
              </Link>
            );
          })}
        </div>
      )}

      {/* Results table */}
      {results.length > 0 && (
        <div className="bg-white border border-gray-200 rounded overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#0a2342] text-white text-xs uppercase">
                <th className="text-left px-4 py-2.5 w-8 text-right text-white/40">#</th>
                <th className="text-left px-4 py-2.5">Institution</th>
                <th className="text-left px-4 py-2.5">City, State</th>
                <th className="text-left px-4 py-2.5">FDIC Cert</th>
                {COLS_AVAILABLE.filter(c => activeCols.includes(c.id)).map(col => (
                  <th key={col.id} className="text-right px-4 py-2.5 cursor-pointer hover:text-[#c9a84c] whitespace-nowrap">
                    <Link href={sortUrl(col.sort)}>{col.label}{sortIcon(col.sort)}</Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={r.idrssd} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-right text-gray-300 font-mono text-xs">
                    {((page - 1) * LIMIT + i + 1).toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 max-w-xs">
                    <Link href={`/bank/${r.idrssd}`} className="text-[#0a2342] hover:text-[#c9a84c] transition-colors font-medium truncate block">
                      {r.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">
                    {r.city}{r.city && r.state ? ", " : ""}{r.state}
                  </td>
                  <td className="px-4 py-2.5 text-gray-400 font-mono text-xs">{r.fdic_cert}</td>
                  {COLS_AVAILABLE.filter(c => activeCols.includes(c.id)).map(col => (
                    <td key={col.id} className="px-4 py-2.5 text-right font-mono text-sm">
                      {colCell(col.id, r)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!hasFilters && (
        <div className="bg-white border border-gray-200 rounded p-12 text-center text-gray-400 text-sm">
          Use the filters above to search across all US banks. Leave the name field blank to browse by size, state, or financial criteria.
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center gap-2 mt-5 justify-center text-sm">
          {page > 1 && (
            <Link href={buildUrl({ page: 1 })} className="px-3 py-1.5 border border-gray-300 rounded bg-white hover:bg-gray-50 text-gray-700">
              « First
            </Link>
          )}
          {page > 1 && (
            <Link href={buildUrl({ page: page - 1 })} className="px-3 py-1.5 border border-gray-300 rounded bg-white hover:bg-gray-50 text-gray-700">
              ← Prev
            </Link>
          )}
          {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
            const start = Math.max(1, Math.min(page - 3, totalPages - 6));
            const pg = start + i;
            return (
              <Link key={pg} href={buildUrl({ page: pg })}
                className={`px-3 py-1.5 border rounded text-sm ${
                  pg === page ? "bg-[#0a2342] text-white border-[#0a2342]" : "bg-white border-gray-300 hover:bg-gray-50 text-gray-700"
                }`}>
                {pg}
              </Link>
            );
          })}
          {page < totalPages && (
            <Link href={buildUrl({ page: page + 1 })} className="px-3 py-1.5 border border-gray-300 rounded bg-white hover:bg-gray-50 text-gray-700">
              Next →
            </Link>
          )}
          {page < totalPages && (
            <Link href={buildUrl({ page: totalPages })} className="px-3 py-1.5 border border-gray-300 rounded bg-white hover:bg-gray-50 text-gray-700">
              Last »
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

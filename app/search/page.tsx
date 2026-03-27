import Link from "next/link";
import { advancedSearch, type SortField } from "@/lib/db";
import { formatDollars } from "@/lib/format";

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
  { value: "total_assets",   label: "Total Assets" },
  { value: "total_deposits", label: "Total Deposits" },
  { value: "total_equity",   label: "Total Equity" },
  { value: "net_income",     label: "Net Income" },
  { value: "equity_ratio",   label: "Equity / Assets" },
];

const EQ_RATIO_OPTIONS = [
  { value: "",   label: "Any" },
  { value: "6",  label: "> 6%" },
  { value: "8",  label: "> 8%" },
  { value: "10", label: "> 10%" },
  { value: "12", label: "> 12%" },
  { value: "15", label: "> 15%" },
];

const LIMIT = 50;

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const p = await searchParams;

  const q               = p.q?.trim() ?? "";
  const state           = p.state?.trim().toUpperCase() ?? "";
  const size            = p.size ?? "";
  const minAssets       = p.minAssets ?? "";
  const maxAssets       = p.maxAssets ?? "";
  const minEquityRatio  = p.minEqRatio ?? "";
  const profitableOnly  = p.profitable ?? "";
  const sort            = (SORT_OPTIONS.find(o => o.value === p.sort)?.value ?? "total_assets") as SortField;
  const sortDir         = p.dir === "asc" ? "asc" : "desc";
  const page            = Math.max(1, parseInt(p.page ?? "1", 10));

  const hasFilters = !!(q || state || size || minAssets || maxAssets || minEquityRatio || profitableOnly);

  const { results, total } = await (async () => {
    if (!hasFilters) return { results: [], total: 0 };
    try {
      return await advancedSearch({ q, state, size, minAssets, maxAssets, minEquityRatio, profitableOnly, sort, sortDir, page, limit: LIMIT });
    } catch {
      return { results: [], total: 0 };
    }
  })();

  const totalPages = Math.ceil(total / LIMIT);

  function buildUrl(overrides: Record<string, string | number>) {
    const sp = new URLSearchParams();
    if (q)              sp.set("q", q);
    if (state)          sp.set("state", state);
    if (size)           sp.set("size", size);
    if (minAssets)      sp.set("minAssets", minAssets);
    if (maxAssets)      sp.set("maxAssets", maxAssets);
    if (minEquityRatio) sp.set("minEqRatio", minEquityRatio);
    if (profitableOnly) sp.set("profitable", profitableOnly);
    if (sort !== "total_assets") sp.set("sort", sort);
    if (sortDir !== "desc")      sp.set("dir", sortDir);
    sp.set("page", String(page));
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

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Filter panel */}
      <form method="GET" action="/search" className="bg-white border border-gray-200 rounded p-5 mb-6 space-y-4">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Advanced Search</div>

        {/* Row 1: name + state + submit */}
        <div className="flex flex-wrap gap-3">
          <input
            name="q"
            defaultValue={q}
            placeholder="Bank name, FDIC cert, or ABA routing…"
            className="flex-1 min-w-56 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#0a2342]"
          />
          <select
            name="state"
            defaultValue={state}
            className="px-3 py-2 text-sm border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-[#0a2342]"
          >
            <option value="">All States</option>
            {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
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

        {/* Row 2: advanced filters */}
        <div className="flex flex-wrap gap-3 pt-1 border-t border-gray-100">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Asset Size</label>
            <select
              name="size"
              defaultValue={size}
              className="px-3 py-2 text-sm border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-[#0a2342]"
            >
              {SIZE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Sort By</label>
            <select
              name="sort"
              defaultValue={sort}
              className="px-3 py-2 text-sm border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-[#0a2342]"
            >
              {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Direction</label>
            <select
              name="dir"
              defaultValue={sortDir}
              className="px-3 py-2 text-sm border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-[#0a2342]"
            >
              <option value="desc">Highest first</option>
              <option value="asc">Lowest first</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Min Equity / Assets</label>
            <select
              name="minEqRatio"
              defaultValue={minEquityRatio}
              className="px-3 py-2 text-sm border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-[#0a2342]"
            >
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
                <th className="text-right px-4 py-2.5 cursor-pointer hover:text-[#c9a84c]">
                  <Link href={sortUrl("total_assets")}>Assets{sortIcon("total_assets")}</Link>
                </th>
                <th className="text-right px-4 py-2.5 cursor-pointer hover:text-[#c9a84c]">
                  <Link href={sortUrl("total_deposits")}>Deposits{sortIcon("total_deposits")}</Link>
                </th>
                <th className="text-right px-4 py-2.5 cursor-pointer hover:text-[#c9a84c]">
                  <Link href={sortUrl("total_equity")}>Equity{sortIcon("total_equity")}</Link>
                </th>
                <th className="text-right px-4 py-2.5 cursor-pointer hover:text-[#c9a84c]">
                  <Link href={sortUrl("equity_ratio")}>Eq/Assets{sortIcon("equity_ratio")}</Link>
                </th>
                <th className="text-right px-4 py-2.5 cursor-pointer hover:text-[#c9a84c]">
                  <Link href={sortUrl("net_income")}>Net Income{sortIcon("net_income")}</Link>
                </th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => {
                const assets = r.total_assets ? Number(r.total_assets) : 0;
                const equity = r.total_equity ? Number(r.total_equity) : 0;
                const eqRatio = assets > 0 ? (equity / assets) * 100 : null;
                return (
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
                    <td className="px-4 py-2.5 text-right font-mono text-sm">
                      {r.total_assets ? formatDollars(Number(r.total_assets)) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-sm">
                      {r.total_deposits ? formatDollars(Number(r.total_deposits)) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-sm">
                      {r.total_equity ? formatDollars(Number(r.total_equity)) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-sm">
                      {eqRatio != null ? `${eqRatio.toFixed(1)}%` : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-sm">
                      {r.net_income ? (
                        <span className={Number(r.net_income) < 0 ? "text-red-600" : ""}>
                          {formatDollars(Number(r.net_income))}
                        </span>
                      ) : "—"}
                    </td>
                  </tr>
                );
              })}
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

import Link from "next/link";
import { browseIndex, getStateCounts, type SortField } from "@/lib/db";
import { formatDollars, formatPct } from "@/lib/format";
import type { IndexRow } from "@/lib/db";

export const runtime = 'nodejs';

const STATE_NAMES: Record<string, string> = {
  AL:"Alabama",AK:"Alaska",AZ:"Arizona",AR:"Arkansas",CA:"California",
  CO:"Colorado",CT:"Connecticut",DE:"Delaware",FL:"Florida",GA:"Georgia",
  HI:"Hawaii",ID:"Idaho",IL:"Illinois",IN:"Indiana",IA:"Iowa",
  KS:"Kansas",KY:"Kentucky",LA:"Louisiana",ME:"Maine",MD:"Maryland",
  MA:"Massachusetts",MI:"Michigan",MN:"Minnesota",MS:"Mississippi",MO:"Missouri",
  MT:"Montana",NE:"Nebraska",NV:"Nevada",NH:"New Hampshire",NJ:"New Jersey",
  NM:"New Mexico",NY:"New York",NC:"North Carolina",ND:"North Dakota",OH:"Ohio",
  OK:"Oklahoma",OR:"Oregon",PA:"Pennsylvania",RI:"Rhode Island",SC:"South Carolina",
  SD:"South Dakota",TN:"Tennessee",TX:"Texas",UT:"Utah",VT:"Vermont",
  VA:"Virginia",WA:"Washington",WV:"West Virginia",WI:"Wisconsin",WY:"Wyoming",
  DC:"D.C.",PR:"Puerto Rico",VI:"Virgin Islands",GU:"Guam",AS:"Am. Samoa",MP:"N. Mariana Is.",
};

type ColDef = { id: string; label: string; sort: SortField };
const COLS_AVAILABLE: ColDef[] = [
  { id: "total_assets",     label: "Assets",      sort: "total_assets"     },
  { id: "total_deposits",   label: "Deposits",    sort: "total_deposits"   },
  { id: "total_equity",     label: "Equity",      sort: "total_equity"     },
  { id: "eq_ratio",         label: "Eq/Assets",   sort: "equity_ratio"     },
  { id: "net_income",       label: "Net Income",  sort: "net_income"       },
  { id: "roa",              label: "ROA",         sort: "roa"              },
  { id: "roe",              label: "ROE",         sort: "roe"              },
  { id: "nim",              label: "NIM",         sort: "nim"              },
  { id: "efficiency_ratio", label: "Efficiency",  sort: "efficiency_ratio" },
  { id: "ltd_ratio",        label: "LTD",         sort: "ltd_ratio"        },
  { id: "npl_ratio",        label: "NPL Ratio",   sort: "npl_ratio"        },
  { id: "coverage_ratio",   label: "Coverage",    sort: "coverage_ratio"   },
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
  if (id === "roa")              return r.roa              ? formatPct(Number(r.roa), 2)              : "—";
  if (id === "roe")              return r.roe              ? formatPct(Number(r.roe), 1)              : "—";
  if (id === "nim")              return r.nim              ? formatPct(Number(r.nim), 2)              : "—";
  if (id === "efficiency_ratio") return r.efficiency_ratio ? formatPct(Number(r.efficiency_ratio), 1) : "—";
  if (id === "ltd_ratio")        return r.ltd_ratio        ? formatPct(Number(r.ltd_ratio), 1)        : "—";
  if (id === "npl_ratio")        return r.npl_ratio        ? formatPct(Number(r.npl_ratio), 2)        : "—";
  if (id === "coverage_ratio")   return r.coverage_ratio   ? formatPct(Number(r.coverage_ratio), 0)   : "—";
  return "—";
}

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: "total_assets",     label: "Total Assets" },
  { value: "total_deposits",   label: "Total Deposits" },
  { value: "total_equity",     label: "Total Equity" },
  { value: "net_income",       label: "Net Income" },
  { value: "equity_ratio",     label: "Eq / Assets" },
  { value: "roa",              label: "ROA" },
  { value: "roe",              label: "ROE" },
  { value: "nim",              label: "NIM" },
  { value: "efficiency_ratio", label: "Efficiency Ratio" },
  { value: "ltd_ratio",        label: "LTD Ratio" },
  { value: "npl_ratio",        label: "NPL Ratio" },
  { value: "coverage_ratio",   label: "Coverage Ratio" },
];

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const selectedState = params.state?.toUpperCase() ?? "";
  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const limit = 50;
  const sort = (SORT_OPTIONS.find(o => o.value === params.sort)?.value ?? "total_assets") as SortField;
  const sortDir = params.dir === "asc" ? "asc" as const : "desc" as const;

  const rawCols = params.cols ? params.cols.split(",").filter(c => COLS_AVAILABLE.some(d => d.id === c)) : null;
  const activeCols = rawCols ?? DEFAULT_COLS;

  let results: Awaited<ReturnType<typeof browseIndex>>["results"] = [];
  let total = 0;
  let stateCounts: Record<string, number> = {};

  try {
    const [res, sc] = await Promise.all([
      browseIndex(selectedState, page, limit, sort, sortDir),
      getStateCounts(),
    ]);
    results = res.results;
    total   = res.total;
    stateCounts = sc;
  } catch {
    // data not yet loaded
  }

  const totalPages = Math.ceil(total / limit);
  const sidebarStates = Object.entries(stateCounts).sort((a, b) => b[1] - a[1]);

  function pageUrl(p: number, overrides: Record<string, string> = {}) {
    const sp = new URLSearchParams();
    if (selectedState) sp.set("state", selectedState);
    if (sort !== "total_assets") sp.set("sort", sort);
    if (sortDir !== "desc")      sp.set("dir", sortDir);
    if (activeCols !== DEFAULT_COLS) sp.set("cols", activeCols.join(","));
    sp.set("page", String(p));
    for (const [k, v] of Object.entries(overrides)) sp.set(k, v);
    return `/explore?${sp.toString()}`;
  }

  function sortUrl(field: SortField) {
    const newDir = sort === field && sortDir === "desc" ? "asc" : "desc";
    return pageUrl(1, { sort: field, dir: newDir });
  }

  function sortIcon(field: SortField) {
    if (sort !== field) return <span className="text-white/30 ml-1">↕</span>;
    return <span className="ml-1">{sortDir === "desc" ? "↓" : "↑"}</span>;
  }

  function toggleColUrl(colId: string) {
    const next = activeCols.includes(colId)
      ? activeCols.filter(c => c !== colId)
      : [...activeCols, colId];
    return pageUrl(1, { cols: next.join(",") });
  }

  function stateUrl(s: string) {
    const sp = new URLSearchParams();
    if (s) sp.set("state", s);
    if (sort !== "total_assets") sp.set("sort", sort);
    if (sortDir !== "desc")      sp.set("dir", sortDir);
    if (activeCols !== DEFAULT_COLS) sp.set("cols", activeCols.join(","));
    return `/explore?${sp.toString()}`;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 flex gap-6">
      {/* Sidebar */}
      <aside className="w-52 flex-shrink-0">
        <div className="bg-white border border-gray-200 rounded overflow-hidden sticky top-4">
          <div className="bg-[#0a2342] text-white text-xs font-semibold uppercase tracking-wide px-4 py-2.5">
            Filter by State
          </div>
          <div className="overflow-y-auto max-h-[calc(100vh-8rem)]">
            <Link
              href={stateUrl("")}
              className={`flex items-center justify-between px-4 py-2 text-sm border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                !selectedState ? "bg-[#0a2342]/5 font-semibold text-[#0a2342]" : "text-gray-700"
              }`}
            >
              <span>All Banks</span>
              <span className="text-xs text-gray-400 font-mono">
                {!selectedState && total ? total.toLocaleString() : Object.values(stateCounts).reduce((a, b) => a + b, 0).toLocaleString()}
              </span>
            </Link>
            {sidebarStates.map(([s, count]) => (
              <Link
                key={s}
                href={stateUrl(s)}
                className={`flex items-center justify-between px-4 py-1.5 text-sm border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                  selectedState === s ? "bg-[#0a2342]/5 font-semibold text-[#0a2342]" : "text-gray-700"
                }`}
              >
                <span className="truncate">{STATE_NAMES[s] ?? s}</span>
                <span className="text-xs text-gray-400 font-mono ml-2 flex-shrink-0">{count.toLocaleString()}</span>
              </Link>
            ))}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Header + sort controls */}
        <div className="flex items-end justify-between mb-3 gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-[#0a2342]">
              {selectedState ? (STATE_NAMES[selectedState] ?? selectedState) : "All Banks"}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {total.toLocaleString()} institution{total !== 1 ? "s" : ""}
            </p>
          </div>
          <form method="GET" action="/explore" className="flex items-center gap-2 flex-shrink-0">
            {selectedState && <input type="hidden" name="state" value={selectedState} />}
            {activeCols !== DEFAULT_COLS && <input type="hidden" name="cols" value={activeCols.join(",")} />}
            <span className="text-xs text-gray-400">Sort:</span>
            <select name="sort" defaultValue={sort}
              className="px-2 py-1.5 text-sm border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-[#0a2342]">
              {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select name="dir" defaultValue={sortDir}
              className="px-2 py-1.5 text-sm border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-[#0a2342]">
              <option value="desc">High → Low</option>
              <option value="asc">Low → High</option>
            </select>
            <button type="submit"
              className="px-3 py-1.5 bg-[#0a2342] text-white text-sm rounded hover:bg-[#0d2d57] transition-colors">
              Go
            </button>
            <span className="text-xs text-gray-400 ml-1">pg {page}/{totalPages || 1}</span>
          </form>
        </div>

        {/* Column picker */}
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

        {results.length > 0 ? (
          <div className="bg-white border border-gray-200 rounded overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#0a2342] text-white text-xs uppercase">
                  <th className="text-left px-4 py-2.5">Institution</th>
                  <th className="text-left px-4 py-2.5">City</th>
                  {!selectedState && <th className="text-left px-4 py-2.5">State</th>}
                  <th className="text-left px-4 py-2.5">FDIC</th>
                  {COLS_AVAILABLE.filter(c => activeCols.includes(c.id)).map(col => (
                    <th key={col.id} className="text-right px-4 py-2.5 cursor-pointer hover:text-[#c9a84c] whitespace-nowrap">
                      <Link href={sortUrl(col.sort)}>{col.label}{sortIcon(col.sort)}</Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map((b, i) => (
                  <tr key={b.idrssd} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2.5 max-w-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-300 font-mono text-xs w-8 flex-shrink-0 text-right">
                          {((page - 1) * limit + i + 1).toLocaleString()}
                        </span>
                        <Link
                          href={`/bank/${b.idrssd}`}
                          className="text-[#0a2342] hover:text-[#c9a84c] transition-colors font-medium truncate"
                        >
                          {b.name}
                        </Link>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 text-sm">{b.city}</td>
                    {!selectedState && <td className="px-4 py-2.5 text-gray-500 text-sm">{b.state}</td>}
                    <td className="px-4 py-2.5 text-gray-400 font-mono text-xs">{b.fdic_cert}</td>
                    {COLS_AVAILABLE.filter(c => activeCols.includes(c.id)).map(col => (
                      <td key={col.id} className="px-4 py-2.5 text-right font-mono text-sm">
                        {colCell(col.id, b)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded p-12 text-center text-gray-400 text-sm">
            No institutions found.
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center gap-2 mt-5 justify-center text-sm">
            {page > 1 && (
              <Link href={pageUrl(1)} className="px-3 py-1.5 border border-gray-300 rounded bg-white hover:bg-gray-50 text-gray-700">« First</Link>
            )}
            {page > 1 && (
              <Link href={pageUrl(page - 1)} className="px-3 py-1.5 border border-gray-300 rounded bg-white hover:bg-gray-50 text-gray-700">← Prev</Link>
            )}
            {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 3, totalPages - 6));
              const pg = start + i;
              return (
                <Link key={pg} href={pageUrl(pg)}
                  className={`px-3 py-1.5 border rounded text-sm ${
                    pg === page ? "bg-[#0a2342] text-white border-[#0a2342]" : "bg-white border-gray-300 hover:bg-gray-50 text-gray-700"
                  }`}>
                  {pg}
                </Link>
              );
            })}
            {page < totalPages && (
              <Link href={pageUrl(page + 1)} className="px-3 py-1.5 border border-gray-300 rounded bg-white hover:bg-gray-50 text-gray-700">Next →</Link>
            )}
            {page < totalPages && (
              <Link href={pageUrl(totalPages)} className="px-3 py-1.5 border border-gray-300 rounded bg-white hover:bg-gray-50 text-gray-700">Last »</Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

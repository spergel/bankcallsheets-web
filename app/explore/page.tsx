import Link from "next/link";
import { browseIndex, getStateCounts } from "@/lib/db";
import { formatDollars } from "@/lib/format";

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

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; page?: string }>;
}) {
  const params = await searchParams;
  const selectedState = params.state?.toUpperCase() ?? "";
  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const limit = 50;

  let results: Awaited<ReturnType<typeof browseIndex>>["results"] = [];
  let total = 0;
  let stateCounts: Record<string, number> = {};

  try {
    const [res, sc] = await Promise.all([
      browseIndex(selectedState, page, limit),
      getStateCounts(),
    ]);
    results = res.results;
    total   = res.total;
    stateCounts = sc;
  } catch {
    // data not yet ingested
  }

  const totalPages = Math.ceil(total / limit);

  // Sort states by count descending for the sidebar
  const sidebarStates = Object.entries(stateCounts)
    .sort((a, b) => b[1] - a[1]);

  function pageUrl(p: number) {
    const sp = new URLSearchParams();
    if (selectedState) sp.set("state", selectedState);
    sp.set("page", String(p));
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
              href="/explore"
              className={`flex items-center justify-between px-4 py-2 text-sm border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                !selectedState ? "bg-[#0a2342]/5 font-semibold text-[#0a2342]" : "text-gray-700"
              }`}
            >
              <span>All Banks</span>
              <span className="text-xs text-gray-400 font-mono">{total && !selectedState ? total.toLocaleString() : Object.values(stateCounts).reduce((a, b) => a + b, 0).toLocaleString()}</span>
            </Link>
            {sidebarStates.map(([s, count]) => (
              <Link
                key={s}
                href={`/explore?state=${s}`}
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
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-[#0a2342]">
              {selectedState ? (STATE_NAMES[selectedState] ?? selectedState) : "All Banks"}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {total.toLocaleString()} institution{total !== 1 ? "s" : ""}
              {selectedState ? ` in ${selectedState}` : " — sorted by total assets"}
            </p>
          </div>
          <span className="text-xs text-gray-400">
            Page {page} of {totalPages || 1}
          </span>
        </div>

        {results.length > 0 ? (
          <div className="bg-white border border-gray-200 rounded overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#0a2342] text-white text-xs uppercase">
                  <th className="text-left px-4 py-2.5">Institution</th>
                  <th className="text-left px-4 py-2.5">City</th>
                  {!selectedState && <th className="text-left px-4 py-2.5">State</th>}
                  <th className="text-left px-4 py-2.5">FDIC Cert</th>
                  <th className="text-right px-4 py-2.5">Total Assets</th>
                  <th className="text-right px-4 py-2.5">Total Deposits</th>
                  <th className="text-right px-4 py-2.5">Total Equity</th>
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
                    <td className="px-4 py-2.5 text-right font-mono text-sm">
                      {b.total_assets ? formatDollars(Number(b.total_assets)) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-sm">
                      {b.total_deposits ? formatDollars(Number(b.total_deposits)) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-sm">
                      {b.total_equity ? formatDollars(Number(b.total_equity)) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded p-12 text-center text-gray-400 text-sm">
            No data found. Run <code className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded">npm run ingest</code> to load bank data.
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center gap-2 mt-5 justify-center text-sm">
            {page > 1 && (
              <Link href={pageUrl(1)} className="px-3 py-1.5 border border-gray-300 rounded bg-white hover:bg-gray-50 text-gray-700">
                « First
              </Link>
            )}
            {page > 1 && (
              <Link href={pageUrl(page - 1)} className="px-3 py-1.5 border border-gray-300 rounded bg-white hover:bg-gray-50 text-gray-700">
                ← Prev
              </Link>
            )}

            {/* Page window */}
            {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 3, totalPages - 6));
              const p = start + i;
              return (
                <Link
                  key={p}
                  href={pageUrl(p)}
                  className={`px-3 py-1.5 border rounded text-sm ${
                    p === page
                      ? "bg-[#0a2342] text-white border-[#0a2342]"
                      : "bg-white border-gray-300 hover:bg-gray-50 text-gray-700"
                  }`}
                >
                  {p}
                </Link>
              );
            })}

            {page < totalPages && (
              <Link href={pageUrl(page + 1)} className="px-3 py-1.5 border border-gray-300 rounded bg-white hover:bg-gray-50 text-gray-700">
                Next →
              </Link>
            )}
            {page < totalPages && (
              <Link href={pageUrl(totalPages)} className="px-3 py-1.5 border border-gray-300 rounded bg-white hover:bg-gray-50 text-gray-700">
                Last »
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

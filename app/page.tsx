import Link from "next/link";
import { getHomeData } from "@/lib/db";
import HomeSearch from "@/components/HomeSearch";

export const revalidate = 3600; // revalidate hourly

function fmtAssets(v: number) {
  if (v >= 1e9)  return `$${(v / 1e9).toFixed(1)}T`;
  if (v >= 1e6)  return `$${(v / 1e6).toFixed(1)}B`;
  if (v >= 1e3)  return `$${(v / 1e3).toFixed(0)}M`;
  return `$${v.toFixed(0)}K`;
}
function fmtPeriod(iso: string) {
  if (!iso) return "—";
  const m = parseInt(iso.slice(5, 7), 10);
  const q = m <= 3 ? "Q1" : m <= 6 ? "Q2" : m <= 9 ? "Q3" : "Q4";
  return `${q} ${iso.slice(0, 4)}`;
}

export default async function HomePage() {
  const data = await getHomeData();

  return (
    <div>
      {/* Hero */}
      <div className="bg-[#0a2342] text-white">
        <div className="max-w-7xl mx-auto px-4 py-16 text-center">
          <h1 className="text-4xl font-bold mb-3 tracking-tight">
            US Bank Financial Data
          </h1>
          <p className="text-white/70 text-lg mb-8 max-w-xl mx-auto">
            25 years of FFIEC Call Report data for every US bank and thrift.
            Search assets, deposits, earnings, capital ratios, and more.
          </p>
          <HomeSearch />
          <div className="mt-4 text-white/40 text-xs">
            Try: &ldquo;JPMorgan Chase&rdquo; · &ldquo;Bank of Hancock County&rdquo; · &ldquo;TX&rdquo; · a routing number
          </div>
        </div>
      </div>

      {/* Stats banner */}
      <div className="bg-[#0d2d54] text-white border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-5 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {[
            ["Institutions", data.institutionCount.toLocaleString()],
            ["Years of Data", "25"],
            ["System Assets", `$${data.totalAssetsTrillion.toFixed(1)}T`],
            ["Latest Period", fmtPeriod(data.latestPeriod)],
          ].map(([label, value]) => (
            <div key={label}>
              <div className="text-2xl font-bold font-mono text-[#c9a84c]">{value}</div>
              <div className="text-xs text-white/50 uppercase tracking-wide mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Leaderboards */}
      <div className="max-w-7xl mx-auto px-4 py-10 grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Largest by assets */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              Largest US Banks — Total Assets
            </h2>
            <Link
              href="/search?sort=total_assets&sortDir=desc"
              className="text-xs text-[#0a2342] hover:text-[#c9a84c] underline underline-offset-2"
            >
              See all →
            </Link>
          </div>
          <div className="bg-white border border-gray-200 rounded overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#0a2342] text-white uppercase text-left">
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Bank</th>
                  <th className="px-3 py-2 text-right">Assets</th>
                  <th className="px-3 py-2 text-right hidden sm:table-cell">Ticker</th>
                </tr>
              </thead>
              <tbody>
                {data.largest.map((r, i) => (
                  <tr key={r.idrssd} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-400 font-mono">{i + 1}</td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/bank/${r.idrssd}`}
                        className="font-medium text-[#0a2342] hover:text-[#c9a84c]"
                      >
                        {r.name}
                      </Link>
                      <span className="text-gray-400 ml-1">{r.state}</span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-[#0a2342]">
                      {fmtAssets(r.total_assets)}
                    </td>
                    <td className="px-3 py-2 text-right hidden sm:table-cell">
                      {r.bhc_ticker
                        ? <span className="bg-[#0a2342] text-white text-[10px] font-bold px-1.5 py-0.5 rounded font-mono">{r.bhc_ticker}</span>
                        : <span className="text-gray-300">—</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Most profitable (ROA) among banks >$1B */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              Highest ROA — Banks over $1B Assets
            </h2>
            <Link
              href="/search?sort=roa&sortDir=desc&size=regional"
              className="text-xs text-[#0a2342] hover:text-[#c9a84c] underline underline-offset-2"
            >
              See all →
            </Link>
          </div>
          <div className="bg-white border border-gray-200 rounded overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#0a2342] text-white uppercase text-left">
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Bank</th>
                  <th className="px-3 py-2 text-right">ROA</th>
                  <th className="px-3 py-2 text-right hidden sm:table-cell">Assets</th>
                </tr>
              </thead>
              <tbody>
                {data.mostProfitable.map((r, i) => (
                  <tr key={r.idrssd} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-400 font-mono">{i + 1}</td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/bank/${r.idrssd}`}
                        className="font-medium text-[#0a2342] hover:text-[#c9a84c]"
                      >
                        {r.name}
                      </Link>
                      <span className="text-gray-400 ml-1">{r.state}</span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-semibold text-green-700">
                      {r.roa != null ? `${(r.roa * 100).toFixed(2)}%` : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-gray-500 hidden sm:table-cell">
                      {fmtAssets(r.total_assets)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Quick links */}
      <div className="max-w-7xl mx-auto px-4 pb-12">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              href: "/explore",
              title: "Explore by State",
              desc: "Browse all banks in any US state, sorted by size or profitability.",
            },
            {
              href: "/search?publicOnly=1&sort=market_cap&sortDir=desc",
              title: "Publicly Traded Banks",
              desc: `${data.publicCount} holding companies with live market data — P/E, P/B, dividend yield.`,
            },
            {
              href: "/search?sort=npl_ratio&sortDir=desc&size=community",
              title: "Asset Quality Screen",
              desc: "Rank community banks by NPL ratio, coverage, and provision rate.",
            },
          ].map(({ href, title, desc }) => (
            <Link
              key={href}
              href={href}
              className="bg-white border border-gray-200 rounded p-5 hover:border-[#0a2342] hover:shadow-sm transition-all group"
            >
              <div className="font-semibold text-[#0a2342] group-hover:text-[#c9a84c] mb-1 transition-colors">
                {title} →
              </div>
              <div className="text-xs text-gray-500">{desc}</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

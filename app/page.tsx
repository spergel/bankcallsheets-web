import Link from "next/link";
import { formatDollars, formatDate } from "@/lib/format";

async function getStats() {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'}/api/stats`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const stats = await getStats();
  const topBanks: { idrssd: number; name: string; state: string; total_assets: number }[] =
    stats?.top_banks ?? [];

  return (
    <div>
      {/* Hero */}
      <section className="bg-[#0a2342] text-white py-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-3xl sm:text-4xl font-bold mb-3 leading-tight">
            US Bank Financial Data
          </h1>
          <p className="text-white/70 text-lg mb-8">
            25 years of FFIEC Call Report filings — every US bank's balance sheet, income, and asset quality.
          </p>
          <form action="/search" method="GET">
            <div className="flex max-w-xl mx-auto">
              <input
                name="q"
                type="text"
                placeholder="Search by bank name, state, or FDIC cert number…"
                className="flex-1 px-4 py-3 text-[#1a1a2e] rounded-l text-sm focus:outline-none"
                autoFocus
              />
              <button
                type="submit"
                className="px-6 py-3 bg-[#c9a84c] text-[#0a2342] font-bold text-sm rounded-r hover:bg-[#b8963f] transition-colors"
              >
                Search
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* Stats banner */}
      <section className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 py-5 grid grid-cols-3 divide-x divide-gray-200 text-center">
          <div className="px-4">
            <div className="text-2xl font-bold text-[#0a2342]">
              {stats?.institution_count ? stats.institution_count.toLocaleString() : "—"}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">Institutions tracked</div>
          </div>
          <div className="px-4">
            <div className="text-2xl font-bold text-[#0a2342]">25</div>
            <div className="text-xs text-gray-500 mt-0.5">Years of data (2001–2025)</div>
          </div>
          <div className="px-4">
            <div className="text-2xl font-bold text-[#0a2342]">
              {stats?.latest_period ? formatDate(stats.latest_period) : "—"}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">Latest reporting period</div>
          </div>
        </div>
      </section>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 py-10 grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Largest Institutions by Total Assets
          </h2>
          {topBanks.length > 0 ? (
            <table className="w-full text-sm bg-white border border-gray-200 rounded">
              <thead>
                <tr className="bg-[#0a2342] text-white text-xs uppercase">
                  <th className="text-left px-4 py-2">#</th>
                  <th className="text-left px-4 py-2">Institution</th>
                  <th className="text-left px-4 py-2">State</th>
                  <th className="text-right px-4 py-2">Total Assets</th>
                </tr>
              </thead>
              <tbody>
                {topBanks.map((bank, i) => (
                  <tr key={bank.idrssd} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-gray-400">{i + 1}</td>
                    <td className="px-4 py-2.5 font-medium">
                      <Link href={`/bank/${bank.idrssd}`} className="text-[#0a2342] hover:text-[#c9a84c] transition-colors">
                        {bank.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-gray-500">{bank.state}</td>
                    <td className="px-4 py-2.5 text-right font-mono">
                      {bank.total_assets != null ? formatDollars(bank.total_assets) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="bg-white border border-gray-200 rounded p-8 text-center text-gray-400 text-sm">
              No data available.
            </div>
          )}
        </div>

        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Explore Data</h2>
          <div className="bg-white border border-gray-200 rounded divide-y divide-gray-100">
            <Link href="/explore" className="flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition-colors group">
              <div>
                <div className="font-medium text-sm text-[#0a2342]">Browse by State</div>
                <div className="text-xs text-gray-500 mt-0.5">Compare banks within a state</div>
              </div>
              <span className="text-gray-300 group-hover:text-[#c9a84c]">→</span>
            </Link>
            <Link href="/search" className="flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition-colors group">
              <div>
                <div className="font-medium text-sm text-[#0a2342]">Search All Banks</div>
                <div className="text-xs text-gray-500 mt-0.5">Find any institution by name</div>
              </div>
              <span className="text-gray-300 group-hover:text-[#c9a84c]">→</span>
            </Link>
            <Link href="/about" className="flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition-colors group">
              <div>
                <div className="font-medium text-sm text-[#0a2342]">About the Data</div>
                <div className="text-xs text-gray-500 mt-0.5">What are FFIEC Call Reports?</div>
              </div>
              <span className="text-gray-300 group-hover:text-[#c9a84c]">→</span>
            </Link>
          </div>
          <div className="mt-6 bg-[#0a2342]/5 border border-[#0a2342]/10 rounded p-4 text-xs text-gray-600 leading-relaxed">
            <strong className="text-[#0a2342]">Data source:</strong> FFIEC Central Data Repository (CDR). Values in thousands of US dollars.
          </div>
        </div>
      </div>
    </div>
  );
}

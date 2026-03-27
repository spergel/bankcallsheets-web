import Link from "next/link";
import type { IndexRow } from "@/lib/db";

function fmtAssets(v: string | number | null) {
  if (!v) return "—";
  const val = Number(v) * 1000;
  if (val >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
  if (val >= 1e9)  return `$${(val / 1e9).toFixed(1)}B`;
  if (val >= 1e6)  return `$${(val / 1e6).toFixed(1)}M`;
  return `$${(val / 1e3).toFixed(0)}K`;
}

function ratio(num: string, den: string, scale = 100): number | null {
  const n = Number(num);
  const d = Number(den);
  if (!num || !den || d === 0) return null;
  return (n / d) * scale;
}

function fmtPct(v: number | null) {
  return v != null ? `${v.toFixed(2)}%` : "—";
}

type PeerRow = {
  row: IndexRow;
  equityRatio: number | null;
  roaProxy: number | null;   // net_income / total_assets — YTD not annualized, but consistent
  depRatio: number | null;   // deposits / assets
  nplProxy: number | null;   // past_due_90+ / assets
};

function buildPeerRow(r: IndexRow): PeerRow {
  return {
    row: r,
    equityRatio: ratio(r.total_equity, r.total_assets),
    roaProxy:    ratio(r.net_income,   r.total_assets),
    depRatio:    ratio(r.total_deposits, r.total_assets),
    nplProxy:    ratio(r.past_due_90_plus, r.total_assets),
  };
}

function RankBar({ value, peers, higher = "good" }: {
  value: number | null;
  peers: (number | null)[];
  higher?: "good" | "bad";
}) {
  if (value == null) return <span className="text-gray-300">—</span>;
  const valid = peers.filter((v): v is number => v != null);
  if (valid.length === 0) return null;
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const range = max - min;
  const pct = range > 0 ? ((value - min) / range) * 100 : 50;
  // rank: 1 = best
  const sorted = [...valid].sort((a, b) => higher === "good" ? b - a : a - b);
  const rank = sorted.indexOf(value) + 1;
  const color = higher === "good"
    ? pct >= 66 ? "bg-green-500" : pct >= 33 ? "bg-yellow-400" : "bg-red-400"
    : pct <= 33 ? "bg-green-500" : pct <= 66 ? "bg-yellow-400" : "bg-red-400";

  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden flex-shrink-0">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-gray-400 text-xs">#{rank}</span>
    </div>
  );
}

export default function PeerComparisonTab({
  subject,
  peers,
}: {
  subject: IndexRow;
  peers: IndexRow[];
}) {
  const all = [subject, ...peers];
  const allRows = all.map(buildPeerRow);
  const subjectRow = allRows[0];
  const peerRows = allRows.slice(1);

  const allEquity = allRows.map(r => r.equityRatio);
  const allRoa    = allRows.map(r => r.roaProxy);
  const allDep    = allRows.map(r => r.depRatio);
  const allNpl    = allRows.map(r => r.nplProxy);

  const assetSize = Number(subject.total_assets);

  function tierLabel(assets: number) {
    const val = assets * 1000;
    if (val >= 1e12) return "> $1T";
    if (val >= 1e11) return "$100B–$1T";
    if (val >= 1e10) return "$10B–$100B";
    if (val >= 1e9)  return "$1B–$10B";
    if (val >= 1e8)  return "$100M–$1B";
    return "< $100M";
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
          Peer Group — Asset Tier {tierLabel(assetSize)}
        </h2>
        <p className="text-xs text-gray-400 mb-4">
          Banks with total assets between {fmtAssets(assetSize * 0.33)} and {fmtAssets(assetSize * 3)},
          sorted by closeness to this institution. Ratios use latest filed period; ROA is YTD (not annualized) and comparable across peers.
        </p>

        <div className="bg-white border border-gray-200 rounded overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#0a2342] text-white uppercase">
                <th className="text-left px-4 py-2">Institution</th>
                <th className="text-left px-4 py-2">State</th>
                <th className="text-right px-4 py-2">Total Assets</th>
                <th className="text-right px-4 py-2">Eq / Assets</th>
                <th className="text-right px-4 py-2">ROA (YTD)</th>
                <th className="text-right px-4 py-2">Dep / Assets</th>
                <th className="text-right px-4 py-2">90d+ / Assets</th>
                <th className="px-4 py-2">Rank</th>
              </tr>
            </thead>
            <tbody>
              {/* Subject bank first, highlighted */}
              <tr className="bg-[#0a2342]/5 border-t-2 border-[#0a2342] font-semibold">
                <td className="px-4 py-2.5">
                  <span className="text-[#0a2342]">{subject.name}</span>
                  <span className="ml-1.5 text-[10px] bg-[#0a2342] text-white px-1.5 py-0.5 rounded">This bank</span>
                </td>
                <td className="px-4 py-2.5">{subject.state}</td>
                <td className="px-4 py-2.5 text-right font-mono">{fmtAssets(subject.total_assets)}</td>
                <td className="px-4 py-2.5 text-right font-mono">{fmtPct(subjectRow.equityRatio)}</td>
                <td className="px-4 py-2.5 text-right font-mono">{fmtPct(subjectRow.roaProxy)}</td>
                <td className="px-4 py-2.5 text-right font-mono">{fmtPct(subjectRow.depRatio)}</td>
                <td className="px-4 py-2.5 text-right font-mono">{fmtPct(subjectRow.nplProxy)}</td>
                <td className="px-4 py-2.5">
                  <RankBar value={subjectRow.roaProxy} peers={allRoa} higher="good" />
                </td>
              </tr>
              {peerRows.map((pr, idx) => (
                <tr key={pr.row.idrssd} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <Link href={`/bank/${pr.row.idrssd}`} className="text-[#0a2342] hover:underline">
                      {pr.row.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{pr.row.state}</td>
                  <td className="px-4 py-2 text-right font-mono">{fmtAssets(pr.row.total_assets)}</td>
                  <td className="px-4 py-2 text-right font-mono">{fmtPct(pr.equityRatio)}</td>
                  <td className="px-4 py-2 text-right font-mono">{fmtPct(pr.roaProxy)}</td>
                  <td className="px-4 py-2 text-right font-mono">{fmtPct(pr.depRatio)}</td>
                  <td className="px-4 py-2 text-right font-mono">{fmtPct(pr.nplProxy)}</td>
                  <td className="px-4 py-2">
                    <RankBar value={pr.roaProxy} peers={allRoa} higher="good" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Metric comparison bars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[
          { label: "Equity / Assets", rows: allRows, key: "equityRatio" as const, higher: "good" as const },
          { label: "ROA (YTD)",        rows: allRows, key: "roaProxy"    as const, higher: "good" as const },
          { label: "Deposits / Assets",rows: allRows, key: "depRatio"    as const, higher: "good" as const },
          { label: "90d+ Past Due / Assets", rows: allRows, key: "nplProxy" as const, higher: "bad" as const },
        ].map(({ label, rows, key, higher }) => {
          const sorted = [...rows]
            .filter(r => r[key] != null)
            .sort((a, b) => higher === "good" ? (b[key]! - a[key]!) : (a[key]! - b[key]!));
          const max = sorted.length > 0 ? (sorted[0][key] ?? 0) : 0;

          return (
            <div key={label} className="bg-white border border-gray-200 rounded p-4">
              <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">{label}</div>
              <div className="space-y-1.5">
                {sorted.slice(0, 10).map(r => {
                  const v = r[key];
                  const isSubject = r.row.idrssd === subject.idrssd;
                  const barPct = max > 0 && v != null ? Math.min((v / max) * 100, 100) : 0;
                  return (
                    <div key={r.row.idrssd} className={`flex items-center gap-2 ${isSubject ? "font-semibold" : ""}`}>
                      <div className="w-28 text-xs text-gray-600 truncate flex-shrink-0"
                           title={r.row.name}>
                        {isSubject ? <span className="text-[#0a2342]">{r.row.name.split(" ").slice(0, 2).join(" ")}</span>
                                   : r.row.name.split(" ").slice(0, 2).join(" ")}
                      </div>
                      <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${isSubject ? "bg-[#0a2342]" : "bg-gray-300"}`}
                          style={{ width: `${barPct}%` }}
                        />
                      </div>
                      <div className="w-14 text-right font-mono text-xs text-gray-700">{fmtPct(v)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

import MetricsGrid from "@/components/MetricsGrid";
import TrendChart from "@/components/TrendChart";
import { delta, formatPeriodLabel, type DerivedPeriod } from "@/lib/bankMetrics";
import { formatDollars } from "@/lib/format";

function fmtDollars(v: number | null) { return v != null ? formatDollars(v) : "—"; }
function fmtPct(v: number | null)     { return v != null ? `${v.toFixed(2)}%` : "—"; }

export default function LoansTab({ periods }: { periods: DerivedPeriod[] }) {
  const latest = periods[periods.length - 1];
  const prevQ  = periods[periods.length - 2] ?? null;
  const prevY  = periods.length >= 5 ? periods[periods.length - 5] : null;

  const metrics = [
    {
      label: "Gross Loans",
      value: latest?.gross_loans ?? null,
      format: "dollars" as const,
      subLabel: "Net of unearned income",
      qoq: delta(latest?.gross_loans, prevQ?.gross_loans),
      yoy: delta(latest?.gross_loans, prevY?.gross_loans),
    },
    {
      label: "Net Loans",
      value: latest?.net_loans ?? null,
      format: "dollars" as const,
      subLabel: "After ALLL deduction",
      qoq: delta(latest?.net_loans, prevQ?.net_loans),
      yoy: delta(latest?.net_loans, prevY?.net_loans),
    },
    {
      label: "Loans Held for Sale",
      value: latest?.loans_held_sale ?? null,
      format: "dollars" as const,
      qoq: delta(latest?.loans_held_sale, prevQ?.loans_held_sale),
    },
    {
      label: "Loan / Deposit",
      value: latest?.ltd_ratio ?? null,
      format: "pct" as const,
      subLabel: "Gross loans / total deposits",
      qoq: delta(latest?.ltd_ratio, prevQ?.ltd_ratio),
    },
    {
      label: "ALLL",
      value: latest?.alll ?? null,
      format: "dollars" as const,
      subLabel: "Allowance for loan losses",
      qoq: delta(latest?.alll, prevQ?.alll),
      yoy: delta(latest?.alll, prevY?.alll),
    },
    {
      label: "NPL Ratio",
      value: latest?.npl_ratio ?? null,
      format: "pct" as const,
      subLabel: "NPLs / gross loans",
    },
    {
      label: "ALLL Coverage",
      value: latest?.alll_coverage ?? null,
      format: "x" as const,
      subLabel: "ALLL / NPLs",
    },
  ];

  // Asset composition for the latest period
  const assets = latest?.total_assets ?? 0;
  const assetSlices = [
    { label: "Gross Loans",     value: latest?.gross_loans,    color: "#0a2342" },
    { label: "AFS Securities",  value: latest?.afs_securities, color: "#c9a84c" },
    { label: "HTM Securities",  value: latest?.htm_securities, color: "#16a34a" },
    { label: "Fed Funds Sold",  value: latest?.fed_funds_sold, color: "#7c3aed" },
    { label: "Loans Held Sale", value: latest?.loans_held_sale,color: "#ea580c" },
  ].filter(s => s.value != null && s.value > 0);

  const knownTotal = assetSlices.reduce((s, x) => s + (x.value ?? 0), 0);
  const other = assets > 0 && knownTotal < assets * 0.95 ? assets - knownTotal : 0;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Loan Portfolio — {latest?.period ? formatPeriodLabel(latest.period) : ""}
        </h2>
        <MetricsGrid metrics={metrics} />
        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
          <strong>Data note:</strong> Loan composition by type (C&amp;I, CRE, residential, consumer) is
          reported on Schedule RC-C, which is not in the FFIEC bulk data subset used here.
          Asset composition below uses available balance sheet totals.
        </div>
      </div>

      {assetSlices.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Asset Composition — {latest?.period ? formatPeriodLabel(latest.period) : ""}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border border-gray-200 rounded overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#0a2342]/5 border-b border-gray-200">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-[#0a2342]">Category</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-[#0a2342]">Balance</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-[#0a2342]">% of Assets</th>
                  </tr>
                </thead>
                <tbody>
                  {assetSlices.map(s => (
                    <tr key={s.label} className="border-t border-gray-100">
                      <td className="px-4 py-2.5 flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: s.color }} />
                        <span className="text-xs text-gray-700">{s.label}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs">{fmtDollars(s.value ?? null)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs">
                        {assets > 0 ? `${((s.value ?? 0) / assets * 100).toFixed(1)}%` : "—"}
                      </td>
                    </tr>
                  ))}
                  {other > 0 && (
                    <tr className="border-t border-gray-100">
                      <td className="px-4 py-2.5 text-xs text-gray-500">Other assets</td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs">{fmtDollars(other)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs">{`${(other / assets * 100).toFixed(1)}%`}</td>
                    </tr>
                  )}
                  <tr className="border-t-2 border-gray-300 bg-gray-50">
                    <td className="px-4 py-2.5 text-xs font-semibold text-gray-700">Total Assets</td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs font-semibold">{fmtDollars(latest?.total_assets ?? null)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs font-semibold">100%</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="bg-white border border-gray-200 rounded p-4 flex flex-col justify-center gap-3">
              {assetSlices.map(s => (
                <div key={s.label}>
                  <div className="flex justify-between text-xs text-gray-600 mb-0.5">
                    <span>{s.label}</span>
                    <span className="font-mono">{assets > 0 ? `${((s.value ?? 0) / assets * 100).toFixed(1)}%` : "—"}</span>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${assets > 0 ? (s.value ?? 0) / assets * 100 : 0}%`, background: s.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {periods.length > 1 && (
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Loan & Asset Trends
          </h2>
          <div className="bg-white border border-gray-200 rounded p-4">
            <TrendChart
              data={periods}
              periodKey="period"
              format="dollars"
              series={[
                { key: "gross_loans",    name: "Gross Loans",    color: "#0a2342" },
                { key: "afs_securities", name: "AFS Securities", color: "#c9a84c" },
                { key: "htm_securities", name: "HTM Securities", color: "#16a34a" },
              ]}
            />
          </div>
        </div>
      )}

      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Period Detail</h2>
        <div className="bg-white border border-gray-200 rounded overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#0a2342] text-white uppercase">
                <th className="text-left px-4 py-2">Period</th>
                <th className="text-right px-4 py-2">Gross Loans</th>
                <th className="text-right px-4 py-2">Net Loans</th>
                <th className="text-right px-4 py-2">ALLL</th>
                <th className="text-right px-4 py-2">AFS Securities</th>
                <th className="text-right px-4 py-2">HTM Securities</th>
                <th className="text-right px-4 py-2">LTD Ratio</th>
              </tr>
            </thead>
            <tbody>
              {[...periods].reverse().map(r => (
                <tr key={r.period} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono">{formatPeriodLabel(r.period)}</td>
                  <td className="px-4 py-2 text-right font-mono">{fmtDollars(r.gross_loans)}</td>
                  <td className="px-4 py-2 text-right font-mono">{fmtDollars(r.net_loans)}</td>
                  <td className="px-4 py-2 text-right font-mono">{fmtDollars(r.alll)}</td>
                  <td className="px-4 py-2 text-right font-mono">{fmtDollars(r.afs_securities)}</td>
                  <td className="px-4 py-2 text-right font-mono">{fmtDollars(r.htm_securities)}</td>
                  <td className="px-4 py-2 text-right font-mono">{fmtPct(r.ltd_ratio)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

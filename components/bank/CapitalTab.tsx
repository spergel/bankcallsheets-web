import MetricsGrid from "@/components/MetricsGrid";
import TrendChart from "@/components/TrendChart";
import { delta, formatPeriodLabel, type DerivedPeriod } from "@/lib/bankMetrics";

function fmtPct(v: number | null) { return v != null ? `${v.toFixed(2)}%` : "—"; }
function fmtDollars(v: number | null) {
  if (v == null) return "—";
  const val = v * 1000;
  if (val >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
  if (val >= 1e9)  return `$${(val / 1e9).toFixed(2)}B`;
  if (val >= 1e6)  return `$${(val / 1e6).toFixed(1)}M`;
  return `$${(val / 1e3).toFixed(0)}K`;
}

export default function CapitalTab({ periods }: { periods: DerivedPeriod[] }) {
  const latest = periods[periods.length - 1];
  const prevQ  = periods[periods.length - 2] ?? null;
  const prevY  = periods.length >= 5 ? periods[periods.length - 5] : null;

  const teRatio = latest?.total_assets && latest?.tangible_equity
    ? (latest.tangible_equity / latest.total_assets) * 100 : null;

  const metrics = [
    {
      label: "Total Equity",
      value: latest?.total_equity ?? null,
      format: "dollars" as const,
      qoq: delta(latest?.total_equity, prevQ?.total_equity),
      yoy: delta(latest?.total_equity, prevY?.total_equity),
    },
    {
      label: "Tangible Equity",
      value: latest?.tangible_equity ?? null,
      format: "dollars" as const,
      subLabel: "Equity − goodwill − intangibles",
      qoq: delta(latest?.tangible_equity, prevQ?.tangible_equity),
      yoy: delta(latest?.tangible_equity, prevY?.tangible_equity),
    },
    {
      label: "Equity / Assets",
      value: latest?.equity_ratio ?? null,
      format: "pct" as const,
      qoq: delta(latest?.equity_ratio, prevQ?.equity_ratio),
      yoy: delta(latest?.equity_ratio, prevY?.equity_ratio),
    },
    {
      label: "Tang. Equity / Assets",
      value: teRatio,
      format: "pct" as const,
      subLabel: "Simple leverage proxy",
    },
    {
      label: "Goodwill",
      value: latest?.goodwill ?? null,
      format: "dollars" as const,
    },
    {
      label: "Subordinated Debt",
      value: latest?.sub_debt ?? null,
      format: "dollars" as const,
    },
    {
      label: "Other Borrowings",
      value: latest?.other_borrowed ?? null,
      format: "dollars" as const,
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Capital & Leverage — {latest?.period ? formatPeriodLabel(latest.period) : ""}
        </h2>
        <MetricsGrid metrics={metrics} />
        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
          <strong>Data note:</strong> Risk-based capital ratios (CET1, Tier 1, Total Capital) are reported on
          Schedule RC-R, which is not included in the FFIEC Call Report bulk data subset used here.
          The equity/asset ratios above are simple book leverage measures.
        </div>
      </div>

      {periods.length > 1 && (
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Equity Capital Trend
          </h2>
          <div className="bg-white border border-gray-200 rounded p-4">
            <TrendChart
              data={periods}
              periodKey="period"
              format="dollars"
              series={[
                { key: "total_equity",    name: "Total Equity",    color: "#0a2342" },
                { key: "tangible_equity", name: "Tangible Equity", color: "#c9a84c" },
                { key: "goodwill",        name: "Goodwill",        color: "#dc2626" },
              ]}
            />
          </div>
        </div>
      )}

      {periods.length > 1 && (
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Equity / Assets Ratio Trend
          </h2>
          <div className="bg-white border border-gray-200 rounded p-4">
            <TrendChart
              data={periods.map(r => ({
                ...r,
                te_ratio: r.total_assets && r.tangible_equity
                  ? (r.tangible_equity / r.total_assets) * 100 : null,
              }))}
              periodKey="period"
              format="pct"
              series={[
                { key: "equity_ratio", name: "Equity / Assets",          color: "#0a2342" },
                { key: "te_ratio",     name: "Tangible Equity / Assets", color: "#c9a84c" },
              ]}
              referenceLines={[{ value: 8, label: "8% guideline", color: "#dc2626" }]}
            />
          </div>
        </div>
      )}

      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Period Detail
        </h2>
        <div className="bg-white border border-gray-200 rounded overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#0a2342] text-white uppercase">
                <th className="text-left px-4 py-2">Period</th>
                <th className="text-right px-4 py-2">Total Equity</th>
                <th className="text-right px-4 py-2">Tangible Equity</th>
                <th className="text-right px-4 py-2">Goodwill</th>
                <th className="text-right px-4 py-2">Eq / Assets</th>
                <th className="text-right px-4 py-2">Tang Eq / Assets</th>
                <th className="text-right px-4 py-2">Subord. Debt</th>
              </tr>
            </thead>
            <tbody>
              {[...periods].reverse().map(r => {
                const te = r.total_assets && r.tangible_equity
                  ? (r.tangible_equity / r.total_assets) * 100 : null;
                return (
                  <tr key={r.period} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono">{formatPeriodLabel(r.period)}</td>
                    <td className="px-4 py-2 text-right font-mono">{fmtDollars(r.total_equity)}</td>
                    <td className="px-4 py-2 text-right font-mono">{fmtDollars(r.tangible_equity)}</td>
                    <td className="px-4 py-2 text-right font-mono">{fmtDollars(r.goodwill)}</td>
                    <td className="px-4 py-2 text-right font-mono">{fmtPct(r.equity_ratio)}</td>
                    <td className="px-4 py-2 text-right font-mono">{fmtPct(te)}</td>
                    <td className="px-4 py-2 text-right font-mono">{fmtDollars(r.sub_debt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

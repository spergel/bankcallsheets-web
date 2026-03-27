import MetricsGrid from "@/components/MetricsGrid";
import TrendChart from "@/components/TrendChart";
import { delta, formatPeriodLabel, type DerivedPeriod } from "@/lib/bankMetrics";

function fmtPct(v: number | null, decimals = 2) {
  return v != null ? `${v.toFixed(decimals)}%` : "—";
}
function fmtX(v: number | null) {
  return v != null ? `${v.toFixed(2)}x` : "—";
}
function fmtDollars(v: number | null) {
  if (v == null) return "—";
  const val = v * 1000;
  if (val >= 1e9)  return `$${(val / 1e9).toFixed(1)}B`;
  if (val >= 1e6)  return `$${(val / 1e6).toFixed(1)}M`;
  return `$${(val / 1e3).toFixed(0)}K`;
}

export default function AssetQualityTab({ periods }: { periods: DerivedPeriod[] }) {
  const latest = periods[periods.length - 1];
  const prevQ  = periods[periods.length - 2] ?? null;
  const prevY  = periods.length >= 5 ? periods[periods.length - 5] : null;

  const metrics = [
    {
      label: "NPL Ratio",
      value: latest?.npl_ratio ?? null,
      format: "pct" as const,
      subLabel: "(Nonaccrual + 90d+ / Total Loans)",
      qoq: delta(latest?.npl_ratio, prevQ?.npl_ratio),
      yoy: delta(latest?.npl_ratio, prevY?.npl_ratio),
    },
    {
      label: "NPA Ratio",
      value: latest?.npa_ratio ?? null,
      format: "pct" as const,
      subLabel: "(NPLs + OREO / Total Assets)",
      qoq: delta(latest?.npa_ratio, prevQ?.npa_ratio),
      yoy: delta(latest?.npa_ratio, prevY?.npa_ratio),
    },
    {
      label: "Texas Ratio",
      value: latest?.texas_ratio ?? null,
      format: "pct" as const,
      subLabel: "(NPAs / Equity + ALLL)",
      qoq: delta(latest?.texas_ratio, prevQ?.texas_ratio),
      yoy: delta(latest?.texas_ratio, prevY?.texas_ratio),
    },
    {
      label: "30–89d Past Due",
      value: latest?.past_due_30_89 ?? null,
      format: "dollars" as const,
      subLabel: "Early-stage delinquencies",
      qoq: delta(latest?.past_due_30_89, prevQ?.past_due_30_89),
      yoy: delta(latest?.past_due_30_89, prevY?.past_due_30_89),
    },
    {
      label: "Provision (YTD)",
      value: latest?.provision ?? null,
      format: "dollars" as const,
      subLabel: "Provision for credit losses",
      qoq: delta(latest?.provision, prevQ?.provision),
      yoy: delta(latest?.provision, prevY?.provision),
    },
    {
      label: "Provision Rate (ann.)",
      value: latest?.provision_rate ?? null,
      format: "pct" as const,
      subLabel: "Annualized provision / gross loans",
    },
    {
      label: "ALLL Coverage",
      value: latest?.alll_coverage ?? null,
      format: "x" as const,
      subLabel: "(ALLL / NPLs)",
      qoq: delta(latest?.alll_coverage, prevQ?.alll_coverage),
      yoy: delta(latest?.alll_coverage, prevY?.alll_coverage),
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Asset Quality Ratios — {latest?.period ? formatPeriodLabel(latest.period) : ""}
        </h2>
        <MetricsGrid metrics={metrics} />
      </div>

      {periods.length > 1 && (
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            NPL & NPA Ratio Trend
          </h2>
          <div className="bg-white border border-gray-200 rounded p-4">
            <TrendChart
              data={periods}
              periodKey="period"
              format="pct"
              series={[
                { key: "npl_ratio",   name: "NPL Ratio",    color: "#dc2626" },
                { key: "npa_ratio",   name: "NPA Ratio",    color: "#ea580c" },
                { key: "texas_ratio", name: "Texas Ratio",  color: "#b45309" },
              ]}
            />
          </div>
        </div>
      )}

      {periods.length > 1 && (
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Nonperforming Loan Balances
          </h2>
          <div className="bg-white border border-gray-200 rounded p-4">
            <TrendChart
              data={periods}
              periodKey="period"
              format="dollars"
              series={[
                { key: "nonaccrual",   name: "Nonaccrual Loans", color: "#dc2626" },
                { key: "past_due_90",  name: "90d+ Past Due",   color: "#ea580c" },
                { key: "past_due_30_89", name: "30–89d Past Due", color: "#f59e0b" },
                { key: "oreo",         name: "OREO",            color: "#b45309" },
                { key: "alll",         name: "ALLL",            color: "#16a34a" },
              ]}
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
                <th className="text-right px-4 py-2">Nonaccrual</th>
                <th className="text-right px-4 py-2">90d+ Past Due</th>
                <th className="text-right px-4 py-2">30–89d Past Due</th>
                <th className="text-right px-4 py-2">OREO</th>
                <th className="text-right px-4 py-2">ALLL</th>
                <th className="text-right px-4 py-2">NPL Ratio</th>
                <th className="text-right px-4 py-2">Texas Ratio</th>
                <th className="text-right px-4 py-2">Provision</th>
                <th className="text-right px-4 py-2">ALLL Coverage</th>
              </tr>
            </thead>
            <tbody>
              {[...periods].reverse().map(r => (
                <tr key={r.period} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono">{formatPeriodLabel(r.period)}</td>
                  <td className="px-4 py-2 text-right font-mono">{fmtDollars(r.nonaccrual)}</td>
                  <td className="px-4 py-2 text-right font-mono">{fmtDollars(r.past_due_90)}</td>
                  <td className="px-4 py-2 text-right font-mono">{fmtDollars(r.past_due_30_89)}</td>
                  <td className="px-4 py-2 text-right font-mono">{fmtDollars(r.oreo)}</td>
                  <td className="px-4 py-2 text-right font-mono">{fmtDollars(r.alll)}</td>
                  <td className="px-4 py-2 text-right font-mono">{fmtPct(r.npl_ratio)}</td>
                  <td className="px-4 py-2 text-right font-mono">{fmtPct(r.texas_ratio)}</td>
                  <td className="px-4 py-2 text-right font-mono">{fmtDollars(r.provision)}</td>
                  <td className="px-4 py-2 text-right font-mono">{fmtX(r.alll_coverage)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

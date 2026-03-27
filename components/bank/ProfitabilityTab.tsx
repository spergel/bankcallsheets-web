import MetricsGrid from "@/components/MetricsGrid";
import TrendChart from "@/components/TrendChart";
import { delta, formatPeriodLabel, type DerivedPeriod } from "@/lib/bankMetrics";

function fmtPct(v: number | null) { return v != null ? `${v.toFixed(2)}%` : "—"; }
function fmtDollars(v: number | null) {
  if (v == null) return "—";
  const val = v * 1000;
  if (val >= 1e9)  return `$${(val / 1e9).toFixed(1)}B`;
  if (val >= 1e6)  return `$${(val / 1e6).toFixed(1)}M`;
  return `$${(val / 1e3).toFixed(0)}K`;
}

export default function ProfitabilityTab({ periods }: { periods: DerivedPeriod[] }) {
  const latest = periods[periods.length - 1];
  const prevQ  = periods[periods.length - 2] ?? null;
  const prevY  = periods.length >= 5 ? periods[periods.length - 5] : null;

  const metrics = [
    {
      label: "ROA (ann.)",
      value: latest?.roa ?? null,
      format: "pct" as const,
      subLabel: "Net Income / Avg Assets",
      qoq: delta(latest?.roa, prevQ?.roa),
      yoy: delta(latest?.roa, prevY?.roa),
    },
    {
      label: "ROE (ann.)",
      value: latest?.roe ?? null,
      format: "pct" as const,
      subLabel: "Net Income / Avg Equity",
      qoq: delta(latest?.roe, prevQ?.roe),
      yoy: delta(latest?.roe, prevY?.roe),
    },
    {
      label: "NIM (ann.)",
      value: latest?.nim ?? null,
      format: "pct" as const,
      subLabel: "NII / Total Assets (approx.)",
      qoq: delta(latest?.nim, prevQ?.nim),
      yoy: delta(latest?.nim, prevY?.nim),
    },
    {
      label: "Efficiency Ratio",
      value: latest?.efficiency ?? null,
      format: "pct" as const,
      subLabel: "NonInt Exp / (NII + NonInt Inc) — lower is better",
      qoq: delta(latest?.efficiency, prevQ?.efficiency),
      yoy: delta(latest?.efficiency, prevY?.efficiency),
    },
    {
      label: "PPNR (ann.)",
      value: latest?.ppnr ?? null,
      format: "dollars" as const,
      subLabel: "Pre-provision net revenue",
      qoq: delta(latest?.ppnr, prevQ?.ppnr),
      yoy: delta(latest?.ppnr, prevY?.ppnr),
    },
    {
      label: "Net Interest Inc.",
      value: latest?.net_interest_inc ?? null,
      format: "dollars" as const,
      subLabel: "YTD",
      qoq: delta(latest?.net_interest_inc, prevQ?.net_interest_inc),
      yoy: delta(latest?.net_interest_inc, prevY?.net_interest_inc),
    },
    {
      label: "Noninterest Inc.",
      value: latest?.nonint_income ?? null,
      format: "dollars" as const,
      subLabel: "YTD",
      qoq: delta(latest?.nonint_income, prevQ?.nonint_income),
      yoy: delta(latest?.nonint_income, prevY?.nonint_income),
    },
    {
      label: "Noninterest Exp.",
      value: latest?.nonint_expense ?? null,
      format: "dollars" as const,
      subLabel: "YTD",
      qoq: delta(latest?.nonint_expense, prevQ?.nonint_expense),
      yoy: delta(latest?.nonint_expense, prevY?.nonint_expense),
    },
    {
      label: "Provision",
      value: latest?.provision ?? null,
      format: "dollars" as const,
      subLabel: "YTD",
      qoq: delta(latest?.provision, prevQ?.provision),
      yoy: delta(latest?.provision, prevY?.provision),
    },
    {
      label: "Provision Rate (ann.)",
      value: latest?.provision_rate ?? null,
      format: "pct" as const,
      subLabel: "Annualized provision / gross loans",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Profitability — {latest?.period ? formatPeriodLabel(latest.period) : ""}
        </h2>
        <MetricsGrid metrics={metrics} />
        <p className="text-xs text-gray-400 mt-2">
          ROA, ROE, NIM are annualized from YTD figures. NIM uses total assets as denominator (not average earning assets).
        </p>
      </div>

      {periods.length > 1 && (
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Return Metrics Trend
          </h2>
          <div className="bg-white border border-gray-200 rounded p-4">
            <TrendChart
              data={periods}
              periodKey="period"
              format="pct"
              series={[
                { key: "roa",        name: "ROA (ann.)",    color: "#0a2342" },
                { key: "roe",        name: "ROE (ann.)",    color: "#c9a84c" },
                { key: "nim",        name: "NIM (ann.)",    color: "#16a34a" },
              ]}
            />
          </div>
        </div>
      )}

      {periods.length > 1 && (
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Efficiency Ratio Trend
          </h2>
          <div className="bg-white border border-gray-200 rounded p-4">
            <TrendChart
              data={periods}
              periodKey="period"
              format="pct"
              series={[
                { key: "efficiency", name: "Efficiency Ratio", color: "#7c3aed" },
              ]}
              referenceLines={[{ value: 60, label: "60% benchmark", color: "#dc2626" }]}
            />
          </div>
        </div>
      )}

      {periods.length > 1 && (
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Interest Income vs. Interest Expense (YTD)
          </h2>
          <div className="bg-white border border-gray-200 rounded p-4">
            <TrendChart
              data={periods}
              periodKey="period"
              format="dollars"
              series={[
                { key: "interest_income",  name: "Interest Income",  color: "#0a2342" },
                { key: "interest_expense", name: "Interest Expense", color: "#dc2626" },
                { key: "net_interest_inc", name: "Net Interest Inc.", color: "#16a34a" },
              ]}
            />
          </div>
        </div>
      )}

      {periods.length > 1 && (
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Revenue & Expense Components (YTD)
          </h2>
          <div className="bg-white border border-gray-200 rounded p-4">
            <TrendChart
              data={periods}
              periodKey="period"
              format="dollars"
              series={[
                { key: "net_interest_inc", name: "Net Interest Inc.", color: "#0a2342" },
                { key: "nonint_income",    name: "Noninterest Inc.",  color: "#16a34a" },
                { key: "nonint_expense",   name: "Noninterest Exp.",  color: "#dc2626" },
                { key: "provision",        name: "Provision",         color: "#ea580c" },
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
                <th className="text-right px-4 py-2">ROA</th>
                <th className="text-right px-4 py-2">ROE</th>
                <th className="text-right px-4 py-2">NIM</th>
                <th className="text-right px-4 py-2">Efficiency</th>
                <th className="text-right px-4 py-2">NII (YTD)</th>
                <th className="text-right px-4 py-2">NonInt Inc</th>
                <th className="text-right px-4 py-2">NonInt Exp</th>
                <th className="text-right px-4 py-2">Provision</th>
              </tr>
            </thead>
            <tbody>
              {[...periods].reverse().map(r => (
                <tr key={r.period} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono">{formatPeriodLabel(r.period)}</td>
                  <td className="px-4 py-2 text-right font-mono">{fmtPct(r.roa)}</td>
                  <td className="px-4 py-2 text-right font-mono">{fmtPct(r.roe)}</td>
                  <td className="px-4 py-2 text-right font-mono">{fmtPct(r.nim)}</td>
                  <td className="px-4 py-2 text-right font-mono">{fmtPct(r.efficiency)}</td>
                  <td className="px-4 py-2 text-right font-mono">{fmtDollars(r.net_interest_inc)}</td>
                  <td className="px-4 py-2 text-right font-mono">{fmtDollars(r.nonint_income)}</td>
                  <td className="px-4 py-2 text-right font-mono">{fmtDollars(r.nonint_expense)}</td>
                  <td className="px-4 py-2 text-right font-mono">{fmtDollars(r.provision)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

import MetricsGrid from "@/components/MetricsGrid";
import TrendChart from "@/components/TrendChart";
import RawDataSection from "@/components/RawDataSection";
import { formatDate } from "@/lib/format";
import { delta, type DerivedPeriod } from "@/lib/bankMetrics";

type Props = {
  periods: DerivedPeriod[];
  rawData: Record<string, number>;
  labelMap: Record<string, string>;
  historyRaw: Record<string, string>[];
};

export default function OverviewTab({ periods, rawData, labelMap, historyRaw }: Props) {
  const latest  = periods[periods.length - 1];
  const prevQ   = periods[periods.length - 2] ?? null;
  const prevY   = periods.length >= 5 ? periods[periods.length - 5] : null;

  const metrics = [
    {
      label: "Total Assets",
      value: latest?.total_assets ?? null,
      format: "dollars" as const,
      qoq: delta(latest?.total_assets, prevQ?.total_assets),
      yoy: delta(latest?.total_assets, prevY?.total_assets),
    },
    {
      label: "Total Deposits",
      value: latest?.total_deposits ?? null,
      format: "dollars" as const,
      qoq: delta(latest?.total_deposits, prevQ?.total_deposits),
      yoy: delta(latest?.total_deposits, prevY?.total_deposits),
    },
    {
      label: "Total Equity",
      value: latest?.total_equity ?? null,
      format: "dollars" as const,
      qoq: delta(latest?.total_equity, prevQ?.total_equity),
      yoy: delta(latest?.total_equity, prevY?.total_equity),
    },
    {
      label: "Gross Loans",
      value: latest?.gross_loans ?? null,
      format: "dollars" as const,
      qoq: delta(latest?.gross_loans, prevQ?.gross_loans),
      yoy: delta(latest?.gross_loans, prevY?.gross_loans),
    },
    {
      label: "Net Income (YTD)",
      value: latest?.net_income ?? null,
      format: "dollars" as const,
      qoq: delta(latest?.net_income, prevQ?.net_income),
      yoy: delta(latest?.net_income, prevY?.net_income),
    },
    {
      label: "Net Interest Inc.",
      value: latest?.net_interest_inc ?? null,
      format: "dollars" as const,
      qoq: delta(latest?.net_interest_inc, prevQ?.net_interest_inc),
      yoy: delta(latest?.net_interest_inc, prevY?.net_interest_inc),
    },
    {
      label: "Loan / Deposit",
      value: latest?.ltd_ratio ?? null,
      format: "pct" as const,
    },
    {
      label: "ROA (ann.)",
      value: latest?.roa ?? null,
      format: "pct" as const,
      yoy: delta(latest?.roa, prevY?.roa),
    },
    {
      label: "ROE (ann.)",
      value: latest?.roe ?? null,
      format: "pct" as const,
      yoy: delta(latest?.roe, prevY?.roe),
    },
    {
      label: "NIM (ann.)",
      value: latest?.nim ?? null,
      format: "pct" as const,
      yoy: delta(latest?.nim, prevY?.nim),
    },
  ];

  const latestPeriod = latest?.period ?? "";

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Key Metrics {latestPeriod ? `— ${formatDate(latestPeriod)}` : ""}
        </h2>
        <MetricsGrid metrics={metrics} />
      </div>

      {periods.length > 1 && (
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Historical Trends — Assets, Deposits & Equity
          </h2>
          <div className="bg-white border border-gray-200 rounded p-4">
            <TrendChart
              data={periods}
              periodKey="period"
              format="dollars"
              series={[
                { key: "total_assets",   name: "Total Assets",   color: "#0a2342" },
                { key: "total_deposits", name: "Total Deposits", color: "#c9a84c" },
                { key: "total_equity",   name: "Total Equity",   color: "#16a34a" },
              ]}
            />
          </div>
        </div>
      )}

      {Object.keys(rawData).length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            All Call Report Fields — Latest Period
          </h2>
          <RawDataSection rawData={rawData} labelMap={labelMap} />
        </div>
      )}

      {historyRaw.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            All Reporting Periods
          </h2>
          <div className="bg-white border border-gray-200 rounded overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#0a2342] text-white text-xs uppercase">
                  <th className="text-left px-4 py-2">Period</th>
                  <th className="text-right px-4 py-2">Total Assets</th>
                  <th className="text-right px-4 py-2">Total Deposits</th>
                  <th className="text-right px-4 py-2">Total Equity</th>
                  <th className="text-right px-4 py-2">Net Income</th>
                  <th className="text-right px-4 py-2">Past Due 90d+</th>
                  <th className="text-right px-4 py-2">Nonaccrual</th>
                </tr>
              </thead>
              <tbody>
                {[...periods].reverse().map((r) => (
                  <PeriodRow key={r.period} r={r} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function fmt(v: number | null): string {
  if (v == null) return "—";
  const val = v * 1000;
  if (val >= 1e12) return `$${(val / 1e12).toFixed(1)}T`;
  if (val >= 1e9)  return `$${(val / 1e9).toFixed(1)}B`;
  if (val >= 1e6)  return `$${(val / 1e6).toFixed(1)}M`;
  return `$${(val / 1e3).toFixed(0)}K`;
}

function PeriodRow({ r }: { r: DerivedPeriod }) {
  return (
    <tr className="border-t border-gray-100 hover:bg-gray-50">
      <td className="px-4 py-2 font-mono text-xs">{r.period.slice(0, 10)}</td>
      <td className="px-4 py-2 text-right font-mono text-xs">{fmt(r.total_assets)}</td>
      <td className="px-4 py-2 text-right font-mono text-xs">{fmt(r.total_deposits)}</td>
      <td className="px-4 py-2 text-right font-mono text-xs">{fmt(r.total_equity)}</td>
      <td className="px-4 py-2 text-right font-mono text-xs">{fmt(r.net_income)}</td>
      <td className="px-4 py-2 text-right font-mono text-xs">{fmt(r.past_due_90)}</td>
      <td className="px-4 py-2 text-right font-mono text-xs">{fmt(r.nonaccrual)}</td>
    </tr>
  );
}

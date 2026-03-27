import MetricsGrid from "@/components/MetricsGrid";
import TrendChart from "@/components/TrendChart";
import { delta, formatPeriodLabel, type DerivedPeriod } from "@/lib/bankMetrics";
import { formatDollars } from "@/lib/format";

function fmtDollars(v: number | null) { return v != null ? formatDollars(v) : "—"; }
function fmtPct(v: number | null)     { return v != null ? `${v.toFixed(2)}%` : "—"; }

export default function DepositsTab({ periods }: { periods: DerivedPeriod[] }) {
  const latest = periods[periods.length - 1];
  const prevQ  = periods[periods.length - 2] ?? null;
  const prevY  = periods.length >= 5 ? periods[periods.length - 5] : null;

  const depToLiab = latest?.total_liabilities && latest?.total_deposits
    ? (latest.total_deposits / latest.total_liabilities) * 100 : null;

  const metrics = [
    {
      label: "Total Deposits",
      value: latest?.total_deposits ?? null,
      format: "dollars" as const,
      qoq: delta(latest?.total_deposits, prevQ?.total_deposits),
      yoy: delta(latest?.total_deposits, prevY?.total_deposits),
    },
    {
      label: "Total Liabilities",
      value: latest?.total_liabilities ?? null,
      format: "dollars" as const,
      qoq: delta(latest?.total_liabilities, prevQ?.total_liabilities),
      yoy: delta(latest?.total_liabilities, prevY?.total_liabilities),
    },
    {
      label: "Deposits / Liabilities",
      value: depToLiab,
      format: "pct" as const,
      subLabel: "Deposit funding share",
    },
    {
      label: "Fed Funds Purchased",
      value: latest?.fed_funds_purch ?? null,
      format: "dollars" as const,
      qoq: delta(latest?.fed_funds_purch, prevQ?.fed_funds_purch),
    },
    {
      label: "Other Borrowings",
      value: latest?.other_borrowed ?? null,
      format: "dollars" as const,
      qoq: delta(latest?.other_borrowed, prevQ?.other_borrowed),
      yoy: delta(latest?.other_borrowed, prevY?.other_borrowed),
    },
    {
      label: "Loan / Deposit",
      value: latest?.ltd_ratio ?? null,
      format: "pct" as const,
      subLabel: "Gross loans / total deposits",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Funding — {latest?.period ? formatPeriodLabel(latest.period) : ""}
        </h2>
        <MetricsGrid metrics={metrics} />
        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
          <strong>Data note:</strong> Deposit breakdown by type (demand, savings, time/CD, brokered) is
          reported on Schedule RC-E, which is not in the FFIEC bulk data subset used here.
          Total deposits and funding composition are shown instead.
        </div>
      </div>

      {periods.length > 1 && (
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Deposit & Funding Trend
          </h2>
          <div className="bg-white border border-gray-200 rounded p-4">
            <TrendChart
              data={periods}
              periodKey="period"
              format="dollars"
              series={[
                { key: "total_deposits",  name: "Total Deposits",    color: "#0a2342" },
                { key: "other_borrowed",  name: "Other Borrowings",  color: "#dc2626" },
                { key: "fed_funds_purch", name: "Fed Funds Purchased", color: "#ea580c" },
              ]}
            />
          </div>
        </div>
      )}

      {periods.length > 1 && (
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Loan / Deposit Ratio Trend
          </h2>
          <div className="bg-white border border-gray-200 rounded p-4">
            <TrendChart
              data={periods}
              periodKey="period"
              format="pct"
              series={[{ key: "ltd_ratio", name: "Loan / Deposit Ratio", color: "#0a2342" }]}
              referenceLines={[{ value: 80, label: "80% guideline", color: "#dc2626" }]}
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
                <th className="text-right px-4 py-2">Total Deposits</th>
                <th className="text-right px-4 py-2">Total Liabilities</th>
                <th className="text-right px-4 py-2">Fed Funds Purch.</th>
                <th className="text-right px-4 py-2">Other Borrowings</th>
                <th className="text-right px-4 py-2">Dep / Liab</th>
                <th className="text-right px-4 py-2">LTD Ratio</th>
              </tr>
            </thead>
            <tbody>
              {[...periods].reverse().map(r => {
                const dtl = r.total_liabilities && r.total_deposits
                  ? (r.total_deposits / r.total_liabilities) * 100 : null;
                return (
                  <tr key={r.period} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono">{formatPeriodLabel(r.period)}</td>
                    <td className="px-4 py-2 text-right font-mono">{fmtDollars(r.total_deposits)}</td>
                    <td className="px-4 py-2 text-right font-mono">{fmtDollars(r.total_liabilities)}</td>
                    <td className="px-4 py-2 text-right font-mono">{fmtDollars(r.fed_funds_purch)}</td>
                    <td className="px-4 py-2 text-right font-mono">{fmtDollars(r.other_borrowed)}</td>
                    <td className="px-4 py-2 text-right font-mono">{fmtPct(dtl)}</td>
                    <td className="px-4 py-2 text-right font-mono">{fmtPct(r.ltd_ratio)}</td>
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

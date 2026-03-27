"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { delta, formatPeriodLabel, type DerivedPeriod } from "@/lib/bankMetrics";

function fmtPct(v: number | null) { return v != null ? `${v.toFixed(1)}%` : "—"; }

function GrowthBarChart({
  data,
  series,
  height = 260,
}: {
  data: Record<string, string | number | null>[];
  series: { key: string; name: string; color: string }[];
  height?: number;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tooltipFmt = (value: any, name: any): [string, typeof name] => {
    const v = typeof value === "number" ? value : null;
    return [v != null ? `${v.toFixed(1)}%` : "—", name];
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="period" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
        <YAxis tickFormatter={v => `${v.toFixed(0)}%`} tick={{ fontSize: 10 }} width={50} />
        <Tooltip formatter={tooltipFmt} labelStyle={{ fontWeight: 600 }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <ReferenceLine y={0} stroke="#6b7280" strokeWidth={1} />
        {series.map(s => (
          <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[2, 2, 0, 0]} maxBarSize={32} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function GrowthTab({ periods }: { periods: DerivedPeriod[] }) {
  const latest = periods[periods.length - 1];

  // Compute YoY growth rates for each period (compare to 4 quarters prior)
  const growthData = periods
    .map((p, i) => {
      const prevY = i >= 4 ? periods[i - 4] : null;
      return {
        period: formatPeriodLabel(p.period),
        assets_yoy:   delta(p.total_assets,   prevY?.total_assets),
        loans_yoy:    delta(p.gross_loans,     prevY?.gross_loans),
        deposits_yoy: delta(p.total_deposits,  prevY?.total_deposits),
        equity_yoy:   delta(p.total_equity,    prevY?.total_equity),
        nii_yoy:      delta(p.net_interest_inc,prevY?.net_interest_inc),
        ni_yoy:       delta(p.net_income,      prevY?.net_income),
      };
    })
    .filter(d => d.assets_yoy != null);

  // QoQ growth rates
  const qoqData = periods
    .map((p, i) => {
      const prevQ = i >= 1 ? periods[i - 1] : null;
      return {
        period: formatPeriodLabel(p.period),
        assets_qoq:   delta(p.total_assets,  prevQ?.total_assets),
        loans_qoq:    delta(p.gross_loans,   prevQ?.gross_loans),
        deposits_qoq: delta(p.total_deposits,prevQ?.total_deposits),
      };
    })
    .filter(d => d.assets_qoq != null);

  // Latest period QoQ/YoY summary
  const i = periods.length - 1;
  const prevQ = i >= 1 ? periods[i - 1] : null;
  const prevY = i >= 4 ? periods[i - 4] : null;

  const summary = [
    { label: "Total Assets",   qoq: delta(latest?.total_assets,   prevQ?.total_assets),   yoy: delta(latest?.total_assets,   prevY?.total_assets) },
    { label: "Gross Loans",    qoq: delta(latest?.gross_loans,    prevQ?.gross_loans),    yoy: delta(latest?.gross_loans,    prevY?.gross_loans) },
    { label: "Total Deposits", qoq: delta(latest?.total_deposits, prevQ?.total_deposits), yoy: delta(latest?.total_deposits, prevY?.total_deposits) },
    { label: "Total Equity",   qoq: delta(latest?.total_equity,   prevQ?.total_equity),   yoy: delta(latest?.total_equity,   prevY?.total_equity) },
    { label: "Net Int. Income",qoq: delta(latest?.net_interest_inc,prevQ?.net_interest_inc),yoy: delta(latest?.net_interest_inc,prevY?.net_interest_inc) },
    { label: "Net Income",     qoq: delta(latest?.net_income,     prevQ?.net_income),     yoy: delta(latest?.net_income,     prevY?.net_income) },
  ];

  function colorClass(v: number | null) {
    if (v == null) return "text-gray-400";
    return v >= 0 ? "text-green-600" : "text-red-600";
  }

  return (
    <div className="space-y-8">
      {/* Summary table */}
      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Growth Summary — {latest?.period ? formatPeriodLabel(latest.period) : ""}
        </h2>
        <div className="bg-white border border-gray-200 rounded overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#0a2342] text-white uppercase">
                <th className="text-left px-4 py-2">Metric</th>
                <th className="text-right px-4 py-2">QoQ %</th>
                <th className="text-right px-4 py-2">YoY %</th>
              </tr>
            </thead>
            <tbody>
              {summary.map(r => (
                <tr key={r.label} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium">{r.label}</td>
                  <td className={`px-4 py-2 text-right font-mono ${colorClass(r.qoq)}`}>
                    {r.qoq != null ? `${r.qoq >= 0 ? "+" : ""}${r.qoq.toFixed(1)}%` : "—"}
                  </td>
                  <td className={`px-4 py-2 text-right font-mono ${colorClass(r.yoy)}`}>
                    {r.yoy != null ? `${r.yoy >= 0 ? "+" : ""}${r.yoy.toFixed(1)}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* YoY growth bar chart */}
      {growthData.length > 1 && (
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Year-over-Year Growth — Balance Sheet
          </h2>
          <div className="bg-white border border-gray-200 rounded p-4">
            <GrowthBarChart
              data={growthData}
              series={[
                { key: "assets_yoy",   name: "Total Assets",   color: "#0a2342" },
                { key: "loans_yoy",    name: "Gross Loans",    color: "#c9a84c" },
                { key: "deposits_yoy", name: "Total Deposits", color: "#16a34a" },
              ]}
            />
          </div>
        </div>
      )}

      {/* YoY income growth */}
      {growthData.length > 1 && (
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Year-over-Year Growth — Income
          </h2>
          <div className="bg-white border border-gray-200 rounded p-4">
            <GrowthBarChart
              data={growthData}
              series={[
                { key: "nii_yoy", name: "Net Interest Income", color: "#0a2342" },
                { key: "ni_yoy",  name: "Net Income",          color: "#16a34a" },
              ]}
            />
          </div>
        </div>
      )}

      {/* QoQ growth */}
      {qoqData.length > 1 && (
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Quarter-over-Quarter Growth — Balance Sheet
          </h2>
          <div className="bg-white border border-gray-200 rounded p-4">
            <GrowthBarChart
              data={qoqData}
              series={[
                { key: "assets_qoq",   name: "Total Assets",   color: "#0a2342" },
                { key: "loans_qoq",    name: "Gross Loans",    color: "#c9a84c" },
                { key: "deposits_qoq", name: "Total Deposits", color: "#16a34a" },
              ]}
            />
          </div>
        </div>
      )}

      {/* Period detail table */}
      {growthData.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            YoY Growth by Period
          </h2>
          <div className="bg-white border border-gray-200 rounded overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#0a2342] text-white uppercase">
                  <th className="text-left px-4 py-2">Period</th>
                  <th className="text-right px-4 py-2">Assets YoY</th>
                  <th className="text-right px-4 py-2">Loans YoY</th>
                  <th className="text-right px-4 py-2">Deposits YoY</th>
                  <th className="text-right px-4 py-2">Equity YoY</th>
                  <th className="text-right px-4 py-2">NII YoY</th>
                  <th className="text-right px-4 py-2">Net Inc. YoY</th>
                </tr>
              </thead>
              <tbody>
                {[...growthData].reverse().map(r => (
                  <tr key={r.period} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono">{r.period}</td>
                    {(["assets_yoy","loans_yoy","deposits_yoy","equity_yoy","nii_yoy","ni_yoy"] as const).map(k => {
                      const v = r[k];
                      return (
                        <td key={k} className={`px-4 py-2 text-right font-mono ${colorClass(v)}`}>
                          {v != null ? `${v >= 0 ? "+" : ""}${fmtPct(v)}` : "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

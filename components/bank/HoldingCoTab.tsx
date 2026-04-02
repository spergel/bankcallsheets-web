"use client";

import TrendChart from "@/components/TrendChart";
import type { BhcFinancialRow } from "@/lib/db";

function fmtD(v: number | null) {
  if (v == null) return "—";
  const val = v * 1000;
  if (val >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
  if (val >= 1e9)  return `$${(val / 1e9).toFixed(2)}B`;
  if (val >= 1e6)  return `$${(val / 1e6).toFixed(1)}M`;
  return `$${(val / 1e3).toFixed(0)}K`;
}
function fmtN(v: number | null, dec = 2) {
  return v != null ? v.toFixed(dec) : "—";
}

export default function HoldingCoTab({
  rows,
  ticker,
  bhcName,
}: {
  rows: BhcFinancialRow[];
  ticker: string;
  bhcName: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="py-12 text-center text-gray-400 text-sm">
        No SEC XBRL data available for this holding company.
      </div>
    );
  }

  const latest = rows[rows.length - 1];
  const prev   = rows[rows.length - 2] ?? null;

  function chg(a: number | null, b: number | null) {
    if (a == null || b == null || b === 0) return null;
    return ((a - b) / Math.abs(b)) * 100;
  }
  function fmtChg(v: number | null) {
    if (v == null) return null;
    const sign = v >= 0 ? "+" : "";
    return `${sign}${v.toFixed(1)}%`;
  }

  const summaryRows: { label: string; val: string; chg: string | null }[] = [
    { label: "Total Assets",       val: fmtD(latest.total_assets),        chg: fmtChg(chg(latest.total_assets, prev?.total_assets)) },
    { label: "Total Deposits",     val: fmtD(latest.total_deposits),      chg: fmtChg(chg(latest.total_deposits, prev?.total_deposits)) },
    { label: "Net Loans",          val: fmtD(latest.net_loans),           chg: fmtChg(chg(latest.net_loans, prev?.net_loans)) },
    { label: "Total Equity",       val: fmtD(latest.total_equity),        chg: fmtChg(chg(latest.total_equity, prev?.total_equity)) },
    { label: "Goodwill",           val: fmtD(latest.goodwill),            chg: null },
    { label: "Net Interest Inc.",  val: fmtD(latest.net_interest_income), chg: fmtChg(chg(latest.net_interest_income, prev?.net_interest_income)) },
    { label: "Noninterest Inc.",   val: fmtD(latest.noninterest_income),  chg: fmtChg(chg(latest.noninterest_income, prev?.noninterest_income)) },
    { label: "Noninterest Exp.",   val: fmtD(latest.noninterest_expense), chg: fmtChg(chg(latest.noninterest_expense, prev?.noninterest_expense)) },
    { label: "Provision",          val: fmtD(latest.provision),           chg: null },
    { label: "Net Income",         val: fmtD(latest.net_income),          chg: fmtChg(chg(latest.net_income, prev?.net_income)) },
    { label: "EPS (diluted)",      val: latest.eps_diluted != null ? `$${fmtN(latest.eps_diluted)}` : "—", chg: fmtChg(chg(latest.eps_diluted, prev?.eps_diluted)) },
    { label: "TBV / Share",        val: latest.tbv_per_share != null ? `$${fmtN(latest.tbv_per_share)}` : "—", chg: fmtChg(chg(latest.tbv_per_share, prev?.tbv_per_share)) },
  ];

  const periodLabel = latest.period_end.slice(0, 4);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
          Holding Company — {bhcName || ticker} · FY {periodLabel}
        </h2>
        <p className="text-xs text-gray-400 mb-3">
          Source: SEC EDGAR XBRL (annual 10-K filings). Values in US GAAP consolidated basis.
          {prev && ` YoY vs FY ${prev.period_end.slice(0, 4)}.`}
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {summaryRows.map(({ label, val, chg }) => (
            <div key={label} className="bg-white border border-gray-200 rounded p-3">
              <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">{label}</div>
              <div className="font-mono text-sm font-semibold text-[#0a2342]">{val}</div>
              {chg && (
                <div className={`text-xs font-mono mt-0.5 ${chg.startsWith("+") ? "text-green-600" : "text-red-600"}`}>
                  {chg} YoY
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {rows.length > 1 && (
        <>
          <div>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Balance Sheet Trend (Annual)
            </h2>
            <div className="bg-white border border-gray-200 rounded p-4">
              <TrendChart
                data={rows as unknown as Record<string, string | number | null | undefined>[]}
                periodKey="period_end"
                format="dollars"
                series={[
                  { key: "total_assets",   name: "Total Assets",   color: "#0a2342" },
                  { key: "total_deposits", name: "Total Deposits",  color: "#c9a84c" },
                  { key: "net_loans",      name: "Net Loans",       color: "#16a34a" },
                  { key: "total_equity",   name: "Total Equity",    color: "#7c3aed" },
                ]}
              />
            </div>
          </div>

          <div>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Income Statement Trend (Annual)
            </h2>
            <div className="bg-white border border-gray-200 rounded p-4">
              <TrendChart
                data={rows as unknown as Record<string, string | number | null | undefined>[]}
                periodKey="period_end"
                format="dollars"
                series={[
                  { key: "net_interest_income",  name: "Net Interest Inc.",  color: "#0a2342" },
                  { key: "noninterest_income",   name: "Noninterest Inc.",   color: "#16a34a" },
                  { key: "noninterest_expense",  name: "Noninterest Exp.",   color: "#dc2626" },
                  { key: "net_income",           name: "Net Income",         color: "#c9a84c" },
                ]}
              />
            </div>
          </div>

          <div>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Per Share (Annual)
            </h2>
            <div className="bg-white border border-gray-200 rounded p-4">
              <TrendChart
                data={rows as unknown as Record<string, string | number | null | undefined>[]}
                periodKey="period_end"
                format="x"
                series={[
                  { key: "eps_diluted",   name: "EPS (diluted)",  color: "#0a2342" },
                  { key: "tbv_per_share", name: "TBV / Share",    color: "#c9a84c" },
                ]}
              />
            </div>
          </div>
        </>
      )}

      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Annual Detail
        </h2>
        <div className="bg-white border border-gray-200 rounded overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#0a2342] text-white uppercase">
                <th className="text-left px-3 py-2">FY</th>
                <th className="text-right px-3 py-2">Assets</th>
                <th className="text-right px-3 py-2">Deposits</th>
                <th className="text-right px-3 py-2">Equity</th>
                <th className="text-right px-3 py-2">NII</th>
                <th className="text-right px-3 py-2">NonInt Inc</th>
                <th className="text-right px-3 py-2">NonInt Exp</th>
                <th className="text-right px-3 py-2">Provision</th>
                <th className="text-right px-3 py-2">Net Inc</th>
                <th className="text-right px-3 py-2">EPS</th>
                <th className="text-right px-3 py-2">TBV/Sh</th>
              </tr>
            </thead>
            <tbody>
              {[...rows].reverse().map(r => (
                <tr key={r.period_end} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-1.5 font-mono">{r.period_end.slice(0, 4)}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{fmtD(r.total_assets)}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{fmtD(r.total_deposits)}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{fmtD(r.total_equity)}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{fmtD(r.net_interest_income)}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{fmtD(r.noninterest_income)}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{fmtD(r.noninterest_expense)}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{fmtD(r.provision)}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{fmtD(r.net_income)}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{r.eps_diluted != null ? `$${fmtN(r.eps_diluted)}` : "—"}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{r.tbv_per_share != null ? `$${fmtN(r.tbv_per_share)}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          Source: SEC EDGAR XBRL · Annual 10-K filings · Values in $000s stored, displayed scaled.
        </p>
      </div>
    </div>
  );
}

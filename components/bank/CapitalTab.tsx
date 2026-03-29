import MetricsGrid from "@/components/MetricsGrid";
import TrendChart from "@/components/TrendChart";
import { delta, formatPeriodLabel, type DerivedPeriod } from "@/lib/bankMetrics";
import type { FdicFinancials } from "@/lib/fdic";

function fmtPct(v: number | null) { return v != null ? `${v.toFixed(2)}%` : "—"; }
function fmtDollars(v: number | null) {
  if (v == null) return "—";
  const val = v * 1000;
  if (val >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
  if (val >= 1e9)  return `$${(val / 1e9).toFixed(2)}B`;
  if (val >= 1e6)  return `$${(val / 1e6).toFixed(1)}M`;
  return `$${(val / 1e3).toFixed(0)}K`;
}

export default function CapitalTab({ periods, fdicFinancials = [] }: { periods: DerivedPeriod[]; fdicFinancials?: FdicFinancials[] }) {
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

  const fdicLatest = fdicFinancials[0] ?? null;
  const hasCapRatios = fdicLatest && (
    fdicLatest.tier1_ratio != null || fdicLatest.total_capital_ratio != null || fdicLatest.leverage_ratio != null
  );

  // Build historical capital ratio series from FDIC data (oldest first for charts)
  const fdicChartData = [...fdicFinancials].reverse().map(f => ({
    period: f.repdte.slice(0, 4) + '-' + f.repdte.slice(4, 6) + '-' + f.repdte.slice(6, 8),
    tier1:    f.tier1_ratio,
    total_cap: f.total_capital_ratio,
    leverage:  f.leverage_ratio,
  }));

  // Regulatory minimums for reference lines
  const WELL_CAPITALIZED_TIER1 = 8;
  const WELL_CAPITALIZED_LEVERAGE = 5;

  return (
    <div className="space-y-8">
      {/* Regulatory capital ratios from FDIC */}
      {hasCapRatios && (
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Regulatory Capital Ratios — {fdicLatest!.repdte ? `${fdicLatest!.repdte.slice(0,4)}-${fdicLatest!.repdte.slice(4,6)}-${fdicLatest!.repdte.slice(6,8)}` : ''} <span className="text-gray-400 normal-case font-normal">(via FDIC)</span>
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            {([
              { label: "Tier 1 Capital Ratio",   value: fdicLatest!.tier1_ratio,         well: 8,  min: 6  },
              { label: "Total Capital Ratio",     value: fdicLatest!.total_capital_ratio, well: 10, min: 8  },
              { label: "Leverage Ratio",          value: fdicLatest!.leverage_ratio,      well: 5,  min: 4  },
              { label: "CET1 Ratio",              value: fdicLatest!.cet1_ratio,          well: 6.5,min: 4.5},
            ] as { label: string; value: number | null; well: number; min: number }[]).map(({ label, value, well }) => {
              const ok = value != null && value >= well;
              const warn = value != null && value < well && value >= well * 0.75;
              const bad  = value != null && value < well * 0.75;
              return (
                <div key={label} className={`bg-white border rounded p-4 ${bad ? 'border-red-300' : warn ? 'border-amber-300' : 'border-gray-200'}`}>
                  <div className="text-xs text-gray-500 mb-1">{label}</div>
                  <div className={`text-2xl font-bold font-mono ${bad ? 'text-red-600' : warn ? 'text-amber-600' : ok ? 'text-green-700' : 'text-gray-400'}`}>
                    {value != null ? `${value.toFixed(2)}%` : '—'}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">Well-capitalized: ≥{well}%</div>
                </div>
              );
            })}
          </div>
          {fdicChartData.length > 1 && (
            <div className="bg-white border border-gray-200 rounded p-4">
              <TrendChart
                data={fdicChartData}
                periodKey="period"
                format="pct"
                series={[
                  { key: "tier1",     name: "Tier 1 Ratio",        color: "#0a2342" },
                  { key: "total_cap", name: "Total Capital Ratio",  color: "#c9a84c" },
                  { key: "leverage",  name: "Leverage Ratio",       color: "#16a34a" },
                ]}
                referenceLines={[
                  { value: WELL_CAPITALIZED_TIER1,     label: "Well-cap Tier 1 (8%)",    color: "#dc2626" },
                  { value: WELL_CAPITALIZED_LEVERAGE,  label: "Well-cap Leverage (5%)",  color: "#7c3aed" },
                ]}
              />
            </div>
          )}
        </div>
      )}

      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Book Capital & Leverage — {latest?.period ? formatPeriodLabel(latest.period) : ""}
        </h2>
        <MetricsGrid metrics={metrics} />
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

      {/* FDIC regulatory capital history table */}
      {fdicFinancials.length > 0 && hasCapRatios && (
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Regulatory Capital History <span className="text-gray-400 normal-case font-normal">(via FDIC)</span>
          </h2>
          <div className="bg-white border border-gray-200 rounded overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#0a2342] text-white uppercase">
                  <th className="text-left px-4 py-2">Period</th>
                  <th className="text-right px-4 py-2">Tier 1 Ratio</th>
                  <th className="text-right px-4 py-2">Total Capital</th>
                  <th className="text-right px-4 py-2">Leverage</th>
                  <th className="text-right px-4 py-2">CET1</th>
                  <th className="text-right px-4 py-2">Total Equity</th>
                </tr>
              </thead>
              <tbody>
                {fdicFinancials.map(f => {
                  const dt = f.repdte ? `${f.repdte.slice(0,4)}-${f.repdte.slice(4,6)}-${f.repdte.slice(6,8)}` : '—';
                  const t1 = f.tier1_ratio;
                  return (
                    <tr key={f.repdte} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-2 font-mono">{dt}</td>
                      <td className={`px-4 py-2 text-right font-mono ${t1 != null && t1 < 6 ? 'text-red-600' : ''}`}>
                        {t1 != null ? `${t1.toFixed(2)}%` : '—'}
                      </td>
                      <td className="px-4 py-2 text-right font-mono">
                        {f.total_capital_ratio != null ? `${f.total_capital_ratio.toFixed(2)}%` : '—'}
                      </td>
                      <td className="px-4 py-2 text-right font-mono">
                        {f.leverage_ratio != null ? `${f.leverage_ratio.toFixed(2)}%` : '—'}
                      </td>
                      <td className="px-4 py-2 text-right font-mono">
                        {f.cet1_ratio != null ? `${f.cet1_ratio.toFixed(2)}%` : '—'}
                      </td>
                      <td className="px-4 py-2 text-right font-mono">{fmtDollars(f.eq)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Book Capital Detail
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

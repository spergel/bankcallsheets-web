import { formatDollars } from "@/lib/format";

type Metric = {
  label: string;
  value: number | null;
  format?: "dollars" | "pct" | "x" | "number";
  qoq?: number | null;   // % change quarter-over-quarter
  yoy?: number | null;   // % change year-over-year
  subLabel?: string;
};

function formatValue(value: number, format: Metric["format"]): string {
  if (format === "pct")    return `${value.toFixed(2)}%`;
  if (format === "x")      return `${value.toFixed(2)}x`;
  if (format === "number") return value.toLocaleString();
  return formatDollars(value);
}

function Delta({ val, label }: { val: number | null | undefined; label: string }) {
  if (val == null) return null;
  const up    = val >= 0;
  const color = up ? "text-green-600" : "text-red-500";
  const arrow = up ? "▲" : "▼";
  return (
    <span className={`text-[10px] ${color} whitespace-nowrap`}>
      {arrow} {Math.abs(val).toFixed(1)}% {label}
    </span>
  );
}

export default function MetricsGrid({ metrics }: { metrics: Metric[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
      {metrics.map((m) => (
        <div key={m.label} className="bg-white rounded border border-gray-200 p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">{m.label}</div>
          <div className="text-xl font-bold text-[#0a2342]">
            {m.value != null ? formatValue(m.value, m.format) : "—"}
          </div>
          {m.subLabel && <div className="text-xs text-gray-400 mt-0.5">{m.subLabel}</div>}
          {(m.qoq != null || m.yoy != null) && (
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
              <Delta val={m.qoq} label="QoQ" />
              <Delta val={m.yoy} label="YoY" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

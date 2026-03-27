"use client";

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { formatPeriodLabel } from "@/lib/bankMetrics";

export type TrendSeries = {
  key: string;
  name: string;
  color: string;
};

type Props = {
  data: Record<string, string | number | null | undefined>[];
  periodKey?: string;
  series: TrendSeries[];
  format: "dollars" | "pct" | "x" | "number";
  height?: number;
  referenceLines?: { value: number; label: string; color?: string }[];
};

function fmtDollars(v: number) {
  const val = v * 1000;
  if (val >= 1e12) return `$${(val / 1e12).toFixed(1)}T`;
  if (val >= 1e9)  return `$${(val / 1e9).toFixed(1)}B`;
  if (val >= 1e6)  return `$${(val / 1e6).toFixed(1)}M`;
  return `$${(val / 1e3).toFixed(0)}K`;
}

function fmtAxis(format: Props["format"]) {
  return (v: number) => {
    if (format === "dollars") return fmtDollars(v);
    if (format === "pct")    return `${v.toFixed(1)}%`;
    if (format === "x")      return `${v.toFixed(2)}x`;
    return v.toLocaleString();
  };
}

function fmtTooltip(format: Props["format"]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (value: any, name: any): [string, typeof name] => {
    const v = typeof value === "number" ? value : null;
    if (v == null) return ["—", name];
    if (format === "dollars") return [fmtDollars(v), name];
    if (format === "pct")     return [`${v.toFixed(2)}%`, name];
    if (format === "x")       return [`${v.toFixed(2)}x`, name];
    return [v.toLocaleString(), name];
  };
}

export default function TrendChart({
  data, periodKey = "period", series, format, height = 260, referenceLines,
}: Props) {
  const chartData = data.map(row => {
    const entry: Record<string, string | number | undefined> = {
      period: formatPeriodLabel(String(row[periodKey] ?? "")),
    };
    for (const s of series) {
      const v = row[s.key];
      entry[s.key] = v == null ? undefined : Number(v);
    }
    return entry;
  });

  const fmt = fmtAxis(format);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="period" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
        <YAxis tickFormatter={fmt} tick={{ fontSize: 10 }} width={65} />
        <Tooltip formatter={fmtTooltip(format)} labelStyle={{ fontWeight: 600 }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {referenceLines?.map(r => (
          <ReferenceLine
            key={r.value}
            y={r.value}
            label={{ value: r.label, fontSize: 9, fill: r.color ?? "#999" }}
            stroke={r.color ?? "#999"}
            strokeDasharray="4 2"
          />
        ))}
        {series.map(s => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.name}
            stroke={s.color}
            strokeWidth={2}
            dot={false}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

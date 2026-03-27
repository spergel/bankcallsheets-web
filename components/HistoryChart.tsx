"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

type Row = {
  period_end_date: string;
  total_assets: number | null;
  total_deposits: number | null;
  total_equity: number | null;
};

function fmt(v: number) {
  const val = v * 1000;
  if (val >= 1e12) return `$${(val / 1e12).toFixed(1)}T`;
  if (val >= 1e9)  return `$${(val / 1e9).toFixed(1)}B`;
  if (val >= 1e6)  return `$${(val / 1e6).toFixed(1)}M`;
  return `$${(val / 1e3).toFixed(0)}K`;
}

export default function HistoryChart({ data }: { data: Row[] }) {
  const chartData = data.map((r) => ({
    year: r.period_end_date?.slice(0, 4) ?? "",
    assets: r.total_assets ?? undefined,
    deposits: r.total_deposits ?? undefined,
    equity: r.total_equity ?? undefined,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="year" tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} width={70} />
        <Tooltip
          formatter={(value, name) => [typeof value === "number" ? fmt(value) : value, name]}
          labelStyle={{ fontWeight: 600 }}
        />
        <Legend />
        <Line
          type="monotone"
          dataKey="assets"
          name="Total Assets"
          stroke="#0a2342"
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="deposits"
          name="Total Deposits"
          stroke="#c9a84c"
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="equity"
          name="Total Equity"
          stroke="#16a34a"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

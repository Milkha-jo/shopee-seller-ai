"use client";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatIDR } from "@/lib/format";
import type { SweepPoint } from "@/hooks/useProfit";

export function MarginChart({ data }: { data: SweepPoint[] }) {
  const series = data.map((d) => ({
    price: d.price,
    margin: d.marginPct === null ? null : Number((d.marginPct * 100).toFixed(2)),
  }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={series} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
        <defs>
          <linearGradient id="marginFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="price"
          tickFormatter={(v) => formatIDR(v)}
          tick={{ fontSize: 11 }}
          interval="preserveStartEnd"
        />
        <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} width={48} />
        <Tooltip
          formatter={(v: number) => [`${v}%`, "Margin"]}
          labelFormatter={(l) => `Price ${formatIDR(l as number)}`}
        />
        <Area
          type="monotone"
          dataKey="margin"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          fill="url(#marginFill)"
          connectNulls
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

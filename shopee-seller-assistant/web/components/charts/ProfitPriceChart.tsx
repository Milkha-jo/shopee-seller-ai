"use client";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatIDR } from "@/lib/format";
import type { SweepPoint } from "@/hooks/useProfit";

export function ProfitPriceChart({ data }: { data: SweepPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="price"
          tickFormatter={(v) => formatIDR(v)}
          tick={{ fontSize: 11 }}
          interval="preserveStartEnd"
        />
        <YAxis tickFormatter={(v) => formatIDR(v)} tick={{ fontSize: 11 }} width={70} />
        <Tooltip
          formatter={(v: number) => [formatIDR(v), "Net profit"]}
          labelFormatter={(l) => `Price ${formatIDR(l as number)}`}
        />
        <Line
          type="monotone"
          dataKey="netProfit"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

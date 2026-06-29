"use client";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { feeLabel, formatIDR, toNumber } from "@/lib/format";
import type { FeeLine } from "@/types/api";

const COLORS = ["hsl(22 92% 52%)", "hsl(199 89% 48%)", "hsl(160 84% 39%)", "hsl(280 65% 60%)"];

export function FeeCompositionChart({ feeLines }: { feeLines: FeeLine[] }) {
  const data = feeLines.map((l) => ({ name: feeLabel(l.feeType), value: toNumber(l.appliedFee) }));
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">No fees to display.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(v: number, n) => [formatIDR(v), n as string]} />
      </PieChart>
    </ResponsiveContainer>
  );
}

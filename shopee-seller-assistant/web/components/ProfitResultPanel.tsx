"use client";
import { Info, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { StatCard } from "@/components/StatCard";
import { CapIndicator } from "@/components/CapIndicator";
import { FeeCompositionChart } from "@/components/charts/FeeCompositionChart";
import { feeLabel, formatIDR, formatPercent, toNumber } from "@/lib/format";
import type { BreakEvenResult, ProfitResult } from "@/types/api";

export function ProfitResultPanel({
  result,
  breakEven,
}: {
  result: ProfitResult;
  breakEven?: BreakEvenResult | null;
}) {
  // Total cost derived from authoritative backend values (netRevenue - netProfit).
  const totalCost = toNumber(result.netRevenue) - toNumber(result.netProfit);
  const profitNumber = toNumber(result.netProfit);

  const breakEvenOk =
    breakEven != null && breakEven.status === "OK" && breakEven.price !== null;
  const breakEvenDisplay =
    breakEven == null
      ? "—"
      : breakEvenOk
        ? formatIDR(breakEven.price as string)
        : "No solution";

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Net Profit" value={formatIDR(result.netProfit)} icon={profitNumber >= 0 ? TrendingUp : TrendingDown} accent={profitNumber >= 0 ? "positive" : "negative"} />
        <StatCard label="Margin" value={formatPercent(result.marginPct)} hint="Profit ÷ price" />
        <StatCard label="Markup" value={formatPercent(result.markupPct)} hint="Profit ÷ cost" />
        <StatCard label="Total Fees" value={formatIDR(result.totalFees)} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Cost" value={formatIDR(totalCost)} />
        <StatCard label="Effective Price" value={formatIDR(result.effectivePrice)} hint="After discount" />
        <StatCard label="Net Revenue" value={formatIDR(result.netRevenue)} hint="Price − fees" />
        <StatCard label="Break-even Price" value={breakEvenDisplay} hint="Zero-profit price" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fee Breakdown</CardTitle>
          <CardDescription>Per-fee detail and cap status from the calculation engine.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fee</TableHead>
                <TableHead>Base</TableHead>
                <TableHead>Raw</TableHead>
                <TableHead>Applied</TableHead>
                <TableHead>Cap</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.feeLines.map((l) => (
                <TableRow key={l.feeType}>
                  <TableCell className="font-medium">{feeLabel(l.feeType)}</TableCell>
                  <TableCell>{formatIDR(l.base)}</TableCell>
                  <TableCell>{formatIDR(l.rawFee)}</TableCell>
                  <TableCell>{formatIDR(l.appliedFee)}</TableCell>
                  <TableCell>
                    <CapIndicator capBound={l.capBound} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center justify-center">
            <FeeCompositionChart feeLines={result.feeLines} />
          </div>
        </CardContent>
      </Card>

      {breakEven != null ? (
        <Alert variant={breakEvenOk ? "info" : "warning"}>
          <Info className="h-4 w-4" />
          <AlertTitle>
            {breakEvenOk
              ? `Break-even at ${formatIDR(breakEven.price as string)}`
              : "No break-even solution"}
          </AlertTitle>
          <AlertDescription>
            {breakEvenOk ? (
              <>
                Minimum selling price for zero profit, solved by the backend
                engine with cap correction.
                {breakEven.bindingCaps.length > 0
                  ? ` Fee caps binding at this price: ${breakEven.bindingCaps
                      .map(feeLabel)
                      .join(", ")}.`
                  : " No fee caps bind at this price."}
              </>
            ) : (
              "Fee rates leave no price at which costs are recovered for this profile."
            )}
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Calculation Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <Row label="Status" value={result.status} />
          <Row label="Effective price" value={formatIDR(result.effectivePrice)} />
          <Row label="Total fees" value={formatIDR(result.totalFees)} />
          <Row label="Net revenue" value={formatIDR(result.netRevenue)} />
          <Row label="Total cost" value={formatIDR(totalCost)} />
          <Row label="Net profit" value={formatIDR(result.netProfit)} />
          <Row label="Break-even price" value={breakEvenDisplay} />
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b py-1.5 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

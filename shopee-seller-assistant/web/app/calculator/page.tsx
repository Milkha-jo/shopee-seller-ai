"use client";
import { useState } from "react";
import { toast } from "sonner";
import { useProfit, useProfitSweep } from "@/hooks/useProfit";
import { useBreakEven } from "@/hooks/useRecommend";
import { ApiError } from "@/services/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CalculatorForm } from "@/components/CalculatorForm";
import { ProfitResultPanel } from "@/components/ProfitResultPanel";
import { RecommendationPanel } from "@/components/RecommendationPanel";
import { ProfitPriceChart } from "@/components/charts/ProfitPriceChart";
import { MarginChart } from "@/components/charts/MarginChart";
import { CardSkeleton, EmptyState } from "@/components/states";
import {
  toBreakEvenRequest,
  toProfitRequest,
  type CalculatorValues,
} from "@/types/schemas";

const errMsg = (e: unknown) =>
  e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Calculation failed";

export default function CalculatorPage() {
  const profit = useProfit();
  const sweep = useProfitSweep();
  const breakEven = useBreakEven();
  const [base, setBase] = useState<CalculatorValues | null>(null);

  const onSubmit = (values: CalculatorValues) => {
    setBase(values);
    profit.mutate(toProfitRequest(values), { onError: (e) => toast.error(errMsg(e)) });
    sweep.mutate(toProfitRequest(values), { onError: () => undefined });
    breakEven.mutate(toBreakEvenRequest(values), { onError: () => undefined });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Profit Calculator</h1>
        <p className="text-muted-foreground">
          All fees, profit, margin and markup are computed by the backend engine.
        </p>
        <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Reminder: Shopee also charges Biaya Proses Pesanan (about Rp1.250 per
          item), which this tool does not include. Add it into the Packaging cost
          (or Other cost) field — for N items, enter N x 1.250.
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Inputs</CardTitle>
              <CardDescription>Enter costs, price and discount.</CardDescription>
            </CardHeader>
            <CardContent>
              <CalculatorForm pending={profit.isPending} onSubmit={onSubmit} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-3">
          {profit.isPending ? (
            <CardSkeleton rows={4} />
          ) : profit.isError ? (
            <EmptyState title="Calculation failed" description={errMsg(profit.error)} />
          ) : profit.data ? (
            <>
              <ProfitResultPanel result={profit.data} breakEven={breakEven.data ?? null} />

              <div className="grid gap-6 xl:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Profit vs Selling Price</CardTitle>
                    <CardDescription>Backend-computed across a price range.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {sweep.isPending ? (
                      <CardSkeleton rows={3} />
                    ) : sweep.data && sweep.data.length > 0 ? (
                      <ProfitPriceChart data={sweep.data} />
                    ) : (
                      <p className="py-8 text-center text-sm text-muted-foreground">No data.</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Margin vs Selling Price</CardTitle>
                    <CardDescription>Margin percentage across the same range.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {sweep.isPending ? (
                      <CardSkeleton rows={3} />
                    ) : sweep.data && sweep.data.length > 0 ? (
                      <MarginChart data={sweep.data} />
                    ) : (
                      <p className="py-8 text-center text-sm text-muted-foreground">No data.</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              <RecommendationPanel base={base} />
            </>
          ) : (
            <EmptyState
              title="No calculation yet"
              description="Fill in the form and run a calculation to see profit, fees and charts."
            />
          )}
        </div>
      </div>
    </div>
  );
}

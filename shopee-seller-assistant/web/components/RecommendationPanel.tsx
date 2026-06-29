"use client";
import { useState } from "react";
import { Info, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/StatCard";
import { CardSkeleton } from "@/components/states";
import { useRecommend } from "@/hooks/useRecommend";
import { ApiError } from "@/services/api";
import { formatIDR, formatPercent } from "@/lib/format";
import { toRecommendRequest, type CalculatorValues } from "@/types/schemas";
import type { RecommendationMode, RecommendResult } from "@/types/api";

const MODES: {
  id: RecommendationMode;
  label: string;
  unit: string;
  hint: string;
  requiresTarget: boolean;
}[] = [
  { id: "TARGET_PROFIT", label: "Target Profit", unit: "Rp", hint: "Desired net profit", requiresTarget: true },
  { id: "TARGET_MARGIN", label: "Target Margin", unit: "%", hint: "Desired margin", requiresTarget: true },
  { id: "TARGET_MARKUP", label: "Target Markup", unit: "%", hint: "Desired markup", requiresTarget: true },
  { id: "MIN_VIABLE", label: "Minimum Viable", unit: "%", hint: "Safety buffer (optional)", requiresTarget: false },
];

const errMsg = (e: unknown) =>
  e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Recommendation failed";

export function RecommendationPanel({ base }: { base: CalculatorValues | null }) {
  const [mode, setMode] = useState<RecommendationMode>("TARGET_PROFIT");
  const [target, setTarget] = useState("");
  const recommend = useRecommend();
  const active = MODES.find((m) => m.id === mode)!;
  const ready = base !== null;
  const needsTarget = active.requiresTarget && target.trim() === "";

  const onMode = (id: RecommendationMode) => {
    setMode(id);
    setTarget("");
    recommend.reset();
  };

  const onSubmit = () => {
    if (!base) return;
    recommend.mutate(toRecommendRequest(base, mode, target));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Price Recommendations</CardTitle>
        <CardDescription>
          Suggest a selling price for a target outcome. The backend solves and round-trips each result.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={mode} onValueChange={(v) => onMode(v as RecommendationMode)}>
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
            {MODES.map((m) => (
              <TabsTrigger key={m.id} value={m.id}>
                {m.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {!ready ? (
          <Alert variant="info">
            <Info className="h-4 w-4" />
            <AlertTitle>Run a calculation first</AlertTitle>
            <AlertDescription>
              Recommendations reuse the costs, date and discount from your calculation above.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="rec-target">
                  {active.label} {active.unit ? `(${active.unit})` : ""}
                </Label>
                <Input
                  id="rec-target"
                  type="number"
                  inputMode="decimal"
                  placeholder={active.hint}
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                />
              </div>
              <Button onClick={onSubmit} disabled={needsTarget || recommend.isPending}>
                <Sparkles className="mr-2 h-4 w-4" />
                {recommend.isPending ? "Solving…" : "Recommend"}
              </Button>
            </div>

            {recommend.isPending ? (
              <CardSkeleton rows={2} />
            ) : recommend.isError ? (
              <Alert variant="destructive">
                <Info className="h-4 w-4" />
                <AlertTitle>Could not get a recommendation</AlertTitle>
                <AlertDescription>{errMsg(recommend.error)}</AlertDescription>
              </Alert>
            ) : recommend.data ? (
              <RecommendationResult result={recommend.data} />
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function RecommendationResult({ result }: { result: RecommendResult }) {
  if (result.feasibility === "INFEASIBLE_CEILING") {
    return (
      <Alert variant="warning">
        <Info className="h-4 w-4" />
        <AlertTitle>Target is above the achievable ceiling</AlertTitle>
        <AlertDescription>
          The uncapped fee rates cap the maximum margin at {formatPercent(result.ceiling)}. Choose a target
          below that. Break-even floor is {formatIDR(result.breakEvenFloor)}.
        </AlertDescription>
      </Alert>
    );
  }

  if (result.feasibility === "NO_SOLUTION" || result.recommendedPrice === null) {
    return (
      <Alert variant="warning">
        <Info className="h-4 w-4" />
        <AlertTitle>No feasible price</AlertTitle>
        <AlertDescription>
          This target cannot be met for the current profile. Break-even floor is{" "}
          {formatIDR(result.breakEvenFloor)}.
        </AlertDescription>
      </Alert>
    );
  }

  const rt = result.roundTrip;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Recommended Price" value={formatIDR(result.recommendedPrice)} accent="positive" />
        <StatCard label="Break-even Floor" value={formatIDR(result.breakEvenFloor)} hint="Zero-profit price" />
        {rt ? <StatCard label="Net Profit" value={formatIDR(rt.netProfit)} hint="Verified round-trip" /> : null}
        {rt ? <StatCard label="Margin" value={formatPercent(rt.marginPct)} /> : null}
      </div>
      {rt ? (
        <p className="text-xs text-muted-foreground">
          Verified by re-running the forward profit engine at the recommended price: effective price{" "}
          {formatIDR(rt.effectivePrice)}, total fees {formatIDR(rt.totalFees)}, markup{" "}
          {formatPercent(rt.markupPct)}.
        </p>
      ) : null}
    </div>
  );
}

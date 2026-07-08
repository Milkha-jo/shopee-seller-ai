"use client";
import { useMemo, useState } from "react";
import { Info, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { StatCard } from "@/components/StatCard";
import { CardSkeleton } from "@/components/states";
import { useRecommend } from "@/hooks/useRecommend";
import { usePromos } from "@/hooks/usePromos";
import { ApiError } from "@/services/api";
import { formatIDR, formatPercent, todayIso } from "@/lib/format";
import { toRecommendRequest, type CalculatorValues } from "@/types/schemas";
import type { RecommendationMode, RecommendResult } from "@/types/api";

const MODES: {
  id: RecommendationMode;
  label: string;
  unit: string;
  hint: string;
  requiresTarget: boolean;
}[] = [
  { id: "TARGET_PROFIT", label: "Target Profit", unit: "Rp", hint: "Profit you want per sale", requiresTarget: true },
  { id: "TARGET_MARGIN", label: "Target Margin", unit: "%", hint: "Margin you want", requiresTarget: true },
  { id: "TARGET_MARKUP", label: "Target Markup", unit: "%", hint: "Markup over cost", requiresTarget: true },
  { id: "MIN_VIABLE", label: "Minimum", unit: "%", hint: "Safety buffer (optional)", requiresTarget: false },
];

const errMsg = (e: unknown) =>
  e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Could not find a price";

export function PriceFinder() {
  const [productCost, setProductCost] = useState("45000");
  const [shippingCost, setShippingCost] = useState("0");
  const [packagingCost, setPackagingCost] = useState("3000");
  const [otherCost, setOtherCost] = useState("0");
  const [asOfDate] = useState(todayIso());
  const [mode, setMode] = useState<RecommendationMode>("TARGET_PROFIT");
  const [target, setTarget] = useState("");
  const [promoId, setPromoId] = useState("NONE");
  const recommend = useRecommend();
  const promos = usePromos();

  const selectedPromo = useMemo(
    () => (promoId === "NONE" ? null : (promos.data ?? []).find((p) => p.id === promoId) ?? null),
    [promoId, promos.data],
  );

  const active = MODES.find((m) => m.id === mode)!;
  const needsTarget = active.requiresTarget && target.trim() === "";

  const onMode = (id: RecommendationMode) => {
    setMode(id);
    setTarget("");
    recommend.reset();
  };

  const onSubmit = () => {
    const extraCost = selectedPromo ? selectedPromo.sellerCost : 0;
    const cv: CalculatorValues = {
      productCost: productCost || "0",
      shippingCost: shippingCost || "0",
      packagingCost: packagingCost || "0",
      otherCost: String(Number(otherCost || "0") + extraCost),
      sellingPrice: "0",
      discountType: "NONE",
      discountValue: "",
      asOfDate,
    };
    const req = toRecommendRequest(cv, mode, target);
    // Apply the promo's buyer discount directly (stored as a decimal rate for %,
    // rupiah for flat — exactly the backend's expected format).
    if (selectedPromo && selectedPromo.buyerDiscountType !== "NONE") {
      req.discount = {
        type: selectedPromo.buyerDiscountType,
        value: selectedPromo.buyerDiscountValue,
      };
    }
    recommend.mutate(req);
  };

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" /> Price Finder
        </CardTitle>
        <CardDescription>
          Enter your costs and the profit you want — get the selling price. No
          need to guess a price. Requires an active fee profile.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Money label="Product cost" value={productCost} onChange={setProductCost} />
          <Money label="Shipping cost" value={shippingCost} onChange={setShippingCost} />
          <Money label="Packaging cost" value={packagingCost} onChange={setPackagingCost} />
          <Money label="Other cost" value={otherCost} onChange={setOtherCost} />
        </div>

        <div className="space-y-1.5">
          <Label>Apply a promo / campaign (optional)</Label>
          <Select value={promoId} onValueChange={setPromoId}>
            <SelectTrigger><SelectValue placeholder="No promo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="NONE">No promo</SelectItem>
              {(promos.data ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedPromo ? (
            <p className="text-xs text-muted-foreground">
              Applying <b>{selectedPromo.name}</b>:
              {selectedPromo.sellerCost > 0 ? ` +${formatIDR(selectedPromo.sellerCost)} cost` : ""}
              {selectedPromo.buyerDiscountType === "PERCENTAGE"
                ? ` · buyer −${formatPercent(selectedPromo.buyerDiscountValue)}`
                : selectedPromo.buyerDiscountType === "FLAT"
                  ? ` · buyer −${formatIDR(selectedPromo.buyerDiscountValue ?? "0")}`
                  : ""}
              . The price below already covers it.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Manage promos on the Promos page. Selecting one adjusts the price to still hit your target.
            </p>
          )}
        </div>

        <Tabs value={mode} onValueChange={(v) => onMode(v as RecommendationMode)}>
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
            {MODES.map((m) => (
              <TabsTrigger key={m.id} value={m.id}>
                {m.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="pf-target">
              {active.label} {active.unit ? `(${active.unit})` : ""}
            </Label>
            <Input
              id="pf-target"
              type="number"
              inputMode="decimal"
              placeholder={active.hint}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
          </div>
          <Button onClick={onSubmit} disabled={needsTarget || recommend.isPending}>
            <Sparkles className="mr-2 h-4 w-4" />
            {recommend.isPending ? "Finding…" : "Find price"}
          </Button>
        </div>

        {recommend.isPending ? (
          <CardSkeleton rows={2} />
        ) : recommend.isError ? (
          <Alert variant="destructive">
            <Info className="h-4 w-4" />
            <AlertTitle>Could not find a price</AlertTitle>
            <AlertDescription>{errMsg(recommend.error)}</AlertDescription>
          </Alert>
        ) : recommend.data ? (
          <PriceResult result={recommend.data} />
        ) : null}
      </CardContent>
    </Card>
  );
}

function Money({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type="number" inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function PriceResult({ result }: { result: RecommendResult }) {
  if (result.feasibility === "INFEASIBLE_CEILING") {
    return (
      <Alert variant="warning">
        <Info className="h-4 w-4" />
        <AlertTitle>Target is too high</AlertTitle>
        <AlertDescription>
          The fees cap the maximum margin at {formatPercent(result.ceiling)}. Pick a lower target.
          Break-even is {formatIDR(result.breakEvenFloor)}.
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
          This target can&rsquo;t be met. Break-even is {formatIDR(result.breakEvenFloor)}.
        </AlertDescription>
      </Alert>
    );
  }
  const rt = result.roundTrip;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Sell at" value={formatIDR(result.recommendedPrice)} accent="positive" />
        <StatCard label="Break-even" value={formatIDR(result.breakEvenFloor)} hint="Zero-profit price" />
        {rt ? <StatCard label="Net Profit" value={formatIDR(rt.netProfit)} hint="Verified" /> : null}
        {rt ? <StatCard label="Margin" value={formatPercent(rt.marginPct)} /> : null}
      </div>
      <p className="text-xs text-muted-foreground">
        Shopee&rsquo;s Biaya Proses Pesanan (Rp1.250/item) is already included
        automatically in this price.
      </p>
    </div>
  );
}

"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Tag, Trash2 } from "lucide-react";
import { usePromos, useCreatePromo, useDeletePromo } from "@/hooks/usePromos";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CardSkeleton, EmptyState, ErrorState } from "@/components/states";
import { formatIDR, formatPercent } from "@/lib/format";
import type { BuyerDiscountType } from "@/types/api";

export default function PromosPage() {
  const promos = usePromos();
  const create = useCreatePromo();
  const del = useDeletePromo();

  const [name, setName] = useState("");
  const [sellerCost, setSellerCost] = useState("0");
  const [discountType, setDiscountType] = useState<BuyerDiscountType>("NONE");
  const [discountValue, setDiscountValue] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");

  const reset = () => {
    setName(""); setSellerCost("0"); setDiscountType("NONE");
    setDiscountValue(""); setStartDate(""); setEndDate(""); setNotes("");
  };

  const submit = () => {
    if (!name.trim()) { toast.error("Give the promo a name"); return; }
    // Percentage stored as decimal rate (20 -> 0.2); flat stored as rupiah string.
    const value =
      discountType === "PERCENTAGE" ? String(Number(discountValue || "0") / 100)
      : discountType === "FLAT" ? String(Number(discountValue || "0"))
      : null;
    create.mutate(
      {
        name: name.trim(),
        sellerCost: Number(sellerCost || "0"),
        buyerDiscountType: discountType,
        buyerDiscountValue: value,
        startDate: startDate || null,
        endDate: endDate || null,
        notes: notes.trim() || null,
      },
      {
        onSuccess: () => { toast.success("Promo saved"); reset(); },
        onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
      },
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Tag className="h-6 w-6" /> Promo &amp; Campaign Library
        </h1>
        <p className="text-muted-foreground">
          Save your campaigns once, then apply them in the Price Finder so your
          price already covers the promo — and you don&rsquo;t sell at a loss.
        </p>
      </div>

      <Alert variant="info">
        <Tag className="h-4 w-4" />
        <AlertTitle>How a promo is applied</AlertTitle>
        <AlertDescription>
          <b>Cost to you</b> (ad spend, voucher you fund) is added to your costs.
          <b> Buyer discount</b> lowers the selling price. A promo can have either,
          both, or neither.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Add a promo</CardTitle>
          <CardDescription>All fields except name are optional.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Flash Sale 12.12" />
            </div>
            <div className="space-y-1.5">
              <Label>Cost to you (Rp per sale)</Label>
              <Input type="number" value={sellerCost} onChange={(e) => setSellerCost(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label>Buyer discount type</Label>
              <Select value={discountType} onValueChange={(v) => setDiscountType(v as BuyerDiscountType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">None</SelectItem>
                  <SelectItem value="PERCENTAGE">Percentage (%)</SelectItem>
                  <SelectItem value="FLAT">Flat (Rp)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>
                Buyer discount {discountType === "PERCENTAGE" ? "(%)" : discountType === "FLAT" ? "(Rp)" : ""}
              </Label>
              <Input
                type="number"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                disabled={discountType === "NONE"}
                placeholder={discountType === "NONE" ? "—" : discountType === "PERCENTAGE" ? "e.g. 20" : "e.g. 5000"}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Start date (optional)</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>End date (optional)</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Notes (optional)</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="anything to remember" />
            </div>
          </div>
          <Button onClick={submit} disabled={create.isPending}>
            {create.isPending ? "Saving…" : "Save promo"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your promos</CardTitle>
        </CardHeader>
        <CardContent>
          {promos.isLoading ? (
            <CardSkeleton rows={3} />
          ) : promos.isError ? (
            <ErrorState message="Could not load promos. Did you run the database setup (0002_promos.sql) in Neon?" />
          ) : !promos.data || promos.data.length === 0 ? (
            <EmptyState title="No promos yet" description="Add your first campaign above." />
          ) : (
            <div className="space-y-2">
              {promos.data.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <div className="min-w-0">
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.sellerCost > 0 ? `Cost to you ${formatIDR(p.sellerCost)}` : "No cost to you"}
                      {" · "}
                      {p.buyerDiscountType === "NONE"
                        ? "No buyer discount"
                        : p.buyerDiscountType === "PERCENTAGE"
                          ? `Buyer −${formatPercent(p.buyerDiscountValue)}`
                          : `Buyer −${formatIDR(p.buyerDiscountValue ?? "0")}`}
                      {p.startDate || p.endDate ? ` · ${p.startDate ?? "…"} → ${p.endDate ?? "…"}` : ""}
                    </p>
                    {p.notes ? <p className="truncate text-xs text-muted-foreground">{p.notes}</p> : null}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      del.mutate(p.id, {
                        onSuccess: () => toast.success("Deleted"),
                        onError: () => toast.error("Delete failed"),
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

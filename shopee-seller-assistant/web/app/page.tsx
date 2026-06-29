"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight, Calculator, Pencil, ReceiptText, Store, TrendingUp } from "lucide-react";
import { useSeller, useUpdateStoreName } from "@/hooks/useSeller";
import { useActiveFeeProfile } from "@/hooks/useFeeProfile";
import { api } from "@/services/api";
import { ApiError } from "@/services/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/StatCard";
import { FeeRulesTable } from "@/components/FeeRulesTable";
import { CardSkeleton, EmptyState, ErrorState } from "@/components/states";
import { formatIDR, formatPercent, tierLabel, todayIso } from "@/lib/format";

export default function DashboardPage() {
  const seller = useSeller();
  const today = todayIso();
  const feeProfile = useActiveFeeProfile(today);

  const example = useQuery({
    queryKey: ["dashboard-example", today],
    enabled: feeProfile.isSuccess,
    queryFn: () =>
      api.calculateProfit({
        asOfDate: today,
        sellingPrice: "100000",
        costInputs: { productCost: "45000", packagingCost: "3000" },
        discount: { type: "NONE", value: null },
      }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your store, fees and profitability.</p>
      </div>

      {/* Store summary */}
      {seller.isLoading ? (
        <CardSkeleton rows={1} />
      ) : seller.isError ? (
        <ErrorState message="Could not load store details." onRetry={() => seller.refetch()} />
      ) : seller.data ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <StoreNameCard name={seller.data.storeName} marketplace={seller.data.marketplace} />
          <StatCard label="Seller tier" value={tierLabel(seller.data.sellerTier)} />
          <StatCard
            label="Active fee profile"
            value={feeProfile.isSuccess ? "Configured" : feeProfile.isLoading ? "…" : "None"}
            hint={feeProfile.isSuccess ? `Effective ${feeProfile.data.profile.effectiveDate}` : undefined}
          />
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Active fee profile */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Active Fee Profile</CardTitle>
              <CardDescription>Fees applied as of {today}</CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/fee-profile">Manage</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {feeProfile.isLoading ? (
              <CardSkeleton rows={3} />
            ) : feeProfile.isError ? (
              feeProfile.error instanceof ApiError && feeProfile.error.status === 404 ? (
                <EmptyState
                  title="No active fee profile"
                  description="Create a fee profile to start calculating profit."
                  action={
                    <Button asChild>
                      <Link href="/fee-profile">Create fee profile</Link>
                    </Button>
                  }
                />
              ) : (
                <ErrorState
                  message={(feeProfile.error as Error).message}
                  onRetry={() => feeProfile.refetch()}
                />
              )
            ) : feeProfile.data ? (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                  <Badge variant="secondary">Source: {feeProfile.data.profile.sourceReference}</Badge>
                  <Badge variant="outline">
                    {feeProfile.data.profile.effectiveDate} →{" "}
                    {feeProfile.data.profile.endDate ?? "open"}
                  </Badge>
                </div>
                <FeeRulesTable rules={feeProfile.data.rules} />
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Profit summary (example) */}
        <Card>
          <CardHeader>
            <CardTitle>Profit Summary</CardTitle>
            <CardDescription>Example at {formatIDR(100000)} selling price</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!feeProfile.isSuccess ? (
              <p className="text-sm text-muted-foreground">
                Configure a fee profile to preview profitability.
              </p>
            ) : example.isLoading ? (
              <CardSkeleton rows={2} />
            ) : example.isError ? (
              <ErrorState message={(example.error as Error).message} onRetry={() => example.refetch()} />
            ) : example.data ? (
              <div className="space-y-3">
                <StatCard
                  label="Net profit"
                  value={formatIDR(example.data.netProfit)}
                  icon={TrendingUp}
                  accent="positive"
                />
                <div className="grid grid-cols-2 gap-3">
                  <StatCard label="Margin" value={formatPercent(example.data.marginPct)} />
                  <StatCard label="Fees" value={formatIDR(example.data.totalFees)} />
                </div>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/calculator">
                    Open calculator <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* Quick navigation */}
      <div className="grid gap-4 sm:grid-cols-2">
        <NavCard
          href="/fee-profile"
          title="Fee Profile"
          description="View, create, replace or deactivate fee versions."
          icon={ReceiptText}
        />
        <NavCard
          href="/calculator"
          title="Profit Calculator"
          description="Compute profit, margin, markup and fee breakdown."
          icon={Calculator}
        />
      </div>
    </div>
  );
}

function StoreNameCard({ name, marketplace }: { name: string; marketplace: string }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const update = useUpdateStoreName();

  const save = () => {
    const trimmed = value.trim();
    if (!trimmed) {
      toast.error("Store name cannot be empty");
      return;
    }
    update.mutate(trimmed, {
      onSuccess: () => {
        toast.success("Store name updated");
        setEditing(false);
      },
      onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed"),
    });
  };

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Store</span>
          {!editing ? (
            <button
              type="button"
              onClick={() => {
                setValue(name);
                setEditing(true);
              }}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Pencil className="h-3 w-3" /> Edit
            </button>
          ) : null}
        </div>
        {!editing ? (
          <div className="mt-2 flex items-center gap-2">
            <Store className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-lg font-semibold leading-tight">{name}</p>
              <p className="text-xs text-muted-foreground">{marketplace}</p>
            </div>
          </div>
        ) : (
          <div className="mt-2 space-y-2">
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Your store name"
              maxLength={100}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={save} disabled={update.isPending}>
                {update.isPending ? "Saving…" : "Save"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={update.isPending}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function NavCard({
  href,
  title,
  description,
  icon: Icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Link href={href}>
      <Card className="transition-colors hover:border-primary">
        <CardContent className="flex items-center gap-4 p-5">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </span>
          <div className="flex-1">
            <p className="font-medium">{title}</p>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </CardContent>
      </Card>
    </Link>
  );
}

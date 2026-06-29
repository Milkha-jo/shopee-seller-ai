"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import {
  useActiveFeeProfile,
  useCreateFeeProfile,
  useDeactivateFeeProfile,
  useReplaceFeeProfile,
} from "@/hooks/useFeeProfile";
import { ApiError } from "@/services/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FeeRulesTable } from "@/components/FeeRulesTable";
import { FeeProfileForm } from "@/components/FeeProfileForm";
import { CardSkeleton, EmptyState, ErrorState } from "@/components/states";
import { todayIso } from "@/lib/format";
import {
  DEFAULT_FEE_PROFILE,
  toFeeProfileRequest,
  type FeeProfileValues,
} from "@/types/schemas";
import type { FeeProfileVersion, FeeType } from "@/types/api";

type Mode = "view" | "create" | "replace";

const errMsg = (e: unknown) =>
  e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Request failed";

function toFormValues(v: FeeProfileVersion): FeeProfileValues {
  const order: FeeType[] = ["ADMIN", "SERVICE", "PAYMENT"];
  return {
    effectiveDate: v.profile.effectiveDate,
    endDate: v.profile.endDate ?? "",
    sourceReference: v.profile.sourceReference,
    rules: order.map((ft) => {
      const r = v.rules.find((x) => x.feeType === ft);
      // Stored as decimal (e.g. "0.09"); show as percentage (e.g. "9").
      const pct = r ? Math.round(Number(r.rate) * 100 * 1000) / 1000 : 0;
      return { feeType: ft, rate: String(pct), cap: r?.cap ?? "" };
    }),
  };
}

export default function FeeProfilePage() {
  const today = todayIso();
  const active = useActiveFeeProfile(today);
  const create = useCreateFeeProfile();
  const replace = useReplaceFeeProfile();
  const deactivate = useDeactivateFeeProfile();
  const [mode, setMode] = useState<Mode>("view");

  const notFound = active.isError && active.error instanceof ApiError && active.error.status === 404;

  const handleCreate = (values: FeeProfileValues) => {
    create.mutate(toFeeProfileRequest(values), {
      onSuccess: () => {
        toast.success("Fee profile created");
        setMode("view");
      },
      onError: (e) => toast.error(errMsg(e)),
    });
  };

  const handleReplace = (values: FeeProfileValues) => {
    if (!active.data) return;
    replace.mutate(
      { id: active.data.profile.id, input: toFeeProfileRequest(values) },
      {
        onSuccess: () => {
          toast.success("Fee profile replaced");
          setMode("view");
        },
        onError: (e) => toast.error(errMsg(e)),
      },
    );
  };

  const handleDeactivate = () => {
    if (!active.data) return;
    deactivate.mutate(active.data.profile.id, {
      onSuccess: () => toast.success("Fee profile deactivated"),
      onError: (e) => toast.error(errMsg(e)),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fee Profile</h1>
          <p className="text-muted-foreground">Manage the fee version applied to your store.</p>
        </div>
        {mode === "view" && active.isSuccess ? (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setMode("replace")}>
              <RefreshCw className="h-4 w-4" /> Replace
            </Button>
            <Button variant="destructive" onClick={handleDeactivate} disabled={deactivate.isPending}>
              <Trash2 className="h-4 w-4" /> Deactivate
            </Button>
          </div>
        ) : null}
      </div>

      {active.isLoading ? (
        <CardSkeleton rows={4} />
      ) : notFound ? (
        mode === "create" ? (
          <CreateCard pending={create.isPending} onSubmit={handleCreate} onCancel={() => setMode("view")} />
        ) : (
          <EmptyState
            title="No active fee profile"
            description="Create one to enable profit calculations."
            action={
              <Button onClick={() => setMode("create")}>
                <Plus className="h-4 w-4" /> Create fee profile
              </Button>
            }
          />
        )
      ) : active.isError ? (
        <ErrorState message={errMsg(active.error)} onRetry={() => active.refetch()} />
      ) : active.data ? (
        mode === "replace" ? (
          <Card>
            <CardHeader>
              <CardTitle>Replace Fee Profile</CardTitle>
              <CardDescription>This deactivates the current version and creates a new one.</CardDescription>
            </CardHeader>
            <CardContent>
              <FeeProfileForm
                defaultValues={toFormValues(active.data)}
                submitLabel="Replace version"
                pending={replace.isPending}
                onSubmit={handleReplace}
              />
              <Button variant="ghost" className="mt-3" onClick={() => setMode("view")}>
                Cancel
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Current Version</CardTitle>
              <CardDescription className="flex flex-wrap gap-2 pt-1">
                <Badge variant="secondary">Source: {active.data.profile.sourceReference}</Badge>
                <Badge variant="outline">
                  {active.data.profile.effectiveDate} → {active.data.profile.endDate ?? "open"}
                </Badge>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FeeRulesTable rules={active.data.rules} />
            </CardContent>
          </Card>
        )
      ) : null}
    </div>
  );
}

function CreateCard({
  pending,
  onSubmit,
  onCancel,
}: {
  pending: boolean;
  onSubmit: (v: FeeProfileValues) => void;
  onCancel: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Fee Profile</CardTitle>
        <CardDescription>Define the fee version for your store.</CardDescription>
      </CardHeader>
      <CardContent>
        <FeeProfileForm
          defaultValues={DEFAULT_FEE_PROFILE}
          submitLabel="Create version"
          pending={pending}
          onSubmit={onSubmit}
        />
        <Button variant="ghost" className="mt-3" onClick={onCancel}>
          Cancel
        </Button>
      </CardContent>
    </Card>
  );
}

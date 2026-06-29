"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { feeLabel } from "@/lib/format";
import { feeProfileSchema, type FeeProfileValues, DEFAULT_FEE_PROFILE } from "@/types/schemas";

export function FeeProfileForm({
  defaultValues = DEFAULT_FEE_PROFILE,
  submitLabel,
  pending,
  onSubmit,
}: {
  defaultValues?: FeeProfileValues;
  submitLabel: string;
  pending: boolean;
  onSubmit: (values: FeeProfileValues) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FeeProfileValues>({
    resolver: zodResolver(feeProfileSchema),
    defaultValues,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Effective date" error={errors.effectiveDate?.message}>
          <Input type="date" {...register("effectiveDate")} />
        </Field>
        <Field label="End date (optional)" error={errors.endDate?.message}>
          <Input type="date" {...register("endDate")} />
        </Field>
        <Field label="Source reference" error={errors.sourceReference?.message}>
          <Input placeholder="shopee-id-2026" {...register("sourceReference")} />
        </Field>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium">Fee rules</p>
        <p className="text-xs text-muted-foreground">
          Rate (%): enter the fee percentage (e.g. type 9 for 9%). Cap: the
          maximum rupiah Shopee charges for that fee — leave empty if Shopee
          states no maximum (most fees have none; only fill it when the fee
          article says &ldquo;maksimal Rp…&rdquo;).
        </p>
        {[0, 1, 2].map((i) => (
          <div key={i} className="grid items-end gap-3 rounded-lg border p-3 sm:grid-cols-3">
            <div>
              <Label>Fee type</Label>
              <p className="mt-2 text-sm font-medium">{feeLabel(DEFAULT_FEE_PROFILE.rules[i]!.feeType)}</p>
              <input type="hidden" {...register(`rules.${i}.feeType` as const)} />
            </div>
            <Field label="Rate (%)" error={errors.rules?.[i]?.rate?.message}>
              <Input step="0.01" type="number" placeholder="e.g. 9 for 9%" {...register(`rules.${i}.rate` as const)} />
            </Field>
            <Field label="Cap (optional)" error={errors.rules?.[i]?.cap?.message}>
              <Input type="number" placeholder="none" {...register(`rules.${i}.cap` as const)} />
            </Field>
          </div>
        ))}
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

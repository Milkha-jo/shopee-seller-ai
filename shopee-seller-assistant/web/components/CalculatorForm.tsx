"use client";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { calculatorSchema, type CalculatorValues } from "@/types/schemas";
import { todayIso } from "@/lib/format";

const DEFAULTS: CalculatorValues = {
  productCost: "45000",
  shippingCost: "0",
  packagingCost: "3000",
  otherCost: "0",
  sellingPrice: "100000",
  discountType: "NONE",
  discountValue: "",
  asOfDate: todayIso(),
};

export function CalculatorForm({
  pending,
  onSubmit,
}: {
  pending: boolean;
  onSubmit: (values: CalculatorValues) => void;
}) {
  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<CalculatorValues>({
    resolver: zodResolver(calculatorSchema),
    defaultValues: DEFAULTS,
  });

  const discountType = watch("discountType");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground">Costs</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Product cost" error={errors.productCost?.message}>
            <Input type="number" {...register("productCost")} />
          </Field>
          <Field label="Shipping cost" error={errors.shippingCost?.message}>
            <Input type="number" {...register("shippingCost")} />
          </Field>
          <Field label="Packaging cost" error={errors.packagingCost?.message}>
            <Input type="number" {...register("packagingCost")} />
          </Field>
          <Field label="Other cost" error={errors.otherCost?.message}>
            <Input type="number" {...register("otherCost")} />
          </Field>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground">Selling &amp; Discount</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Selling price" error={errors.sellingPrice?.message}>
            <Input type="number" {...register("sellingPrice")} />
          </Field>
          <Field label="Calculation date" error={errors.asOfDate?.message}>
            <Input type="date" {...register("asOfDate")} />
          </Field>
          <Field label="Discount type">
            <Controller
              control={control}
              name="discountType"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">None</SelectItem>
                    <SelectItem value="PERCENTAGE">Percentage</SelectItem>
                    <SelectItem value="FLAT">Flat</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          {discountType !== "NONE" ? (
            <Field
              label={discountType === "PERCENTAGE" ? "Discount (%)" : "Discount (Rp)"}
              error={errors.discountValue?.message}
            >
              <Input type="number" {...register("discountValue")} />
            </Field>
          ) : null}
        </div>
      </section>

      <Button type="submit" disabled={pending}>
        {pending ? "Calculating…" : "Calculate profit"}
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

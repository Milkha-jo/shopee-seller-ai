"use client";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/services/api";
import type { ProfitRequestInput, ProfitResult } from "@/types/api";

export interface SweepPoint {
  price: number;
  netProfit: number;
  marginPct: number | null;
}

export function useProfit() {
  return useMutation<ProfitResult, Error, ProfitRequestInput>({
    mutationFn: (input) => api.calculateProfit(input),
  });
}

/** Build a Profit-vs-Price series by asking the BACKEND for profit at several
 *  prices around the base price. No profit is computed on the client. */
export function buildSweepRequests(
  base: ProfitRequestInput,
  steps = 9,
): { price: number; request: ProfitRequestInput }[] {
  const center = Number(base.sellingPrice);
  if (!Number.isFinite(center) || center <= 0) return [];
  const lo = center * 0.5;
  const hi = center * 1.5;
  const out: { price: number; request: ProfitRequestInput }[] = [];
  for (let i = 0; i < steps; i++) {
    const price = Math.round(lo + ((hi - lo) * i) / (steps - 1));
    out.push({ price, request: { ...base, sellingPrice: String(price) } });
  }
  return out;
}

export function useProfitSweep() {
  return useMutation<SweepPoint[], Error, ProfitRequestInput>({
    mutationFn: async (base) => {
      const reqs = buildSweepRequests(base);
      const results = await Promise.all(
        reqs.map(async ({ price, request }) => {
          const r = await api.calculateProfit(request);
          return {
            price,
            netProfit: Number(r.netProfit),
            marginPct: r.marginPct === null ? null : Number(r.marginPct),
          };
        }),
      );
      return results;
    },
  });
}

"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import type { Promo, NewPromoInput } from "@/types/api";

const promosKey = ["promos"] as const;

export function usePromos() {
  return useQuery({ queryKey: promosKey, queryFn: api.listPromos, staleTime: 30_000 });
}

export function useCreatePromo() {
  const qc = useQueryClient();
  return useMutation<Promo, Error, NewPromoInput>({
    mutationFn: (input) => api.createPromo(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: promosKey }),
  });
}

export function useDeletePromo() {
  const qc = useQueryClient();
  return useMutation<{ deleted: boolean }, Error, string>({
    mutationFn: (id) => api.deletePromo(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: promosKey }),
  });
}

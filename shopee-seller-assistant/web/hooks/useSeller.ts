"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import type { Seller } from "@/types/api";

export const sellerKey = ["seller"] as const;

export function useSeller() {
  return useQuery({ queryKey: sellerKey, queryFn: api.getSeller, staleTime: 60_000 });
}

export function useUpdateStoreName() {
  const qc = useQueryClient();
  return useMutation<Seller, Error, string>({
    mutationFn: (storeName) => api.updateStoreName(storeName),
    onSuccess: (seller) => {
      qc.setQueryData(sellerKey, seller);
      qc.invalidateQueries({ queryKey: sellerKey });
    },
  });
}

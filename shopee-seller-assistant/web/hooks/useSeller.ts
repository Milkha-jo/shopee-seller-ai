"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";

export const sellerKey = ["seller"] as const;

export function useSeller() {
  return useQuery({ queryKey: sellerKey, queryFn: api.getSeller, staleTime: 60_000 });
}

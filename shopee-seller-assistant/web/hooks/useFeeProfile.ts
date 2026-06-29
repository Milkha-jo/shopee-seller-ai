"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import type { NewFeeProfileVersionInput } from "@/types/api";
import { todayIso } from "@/lib/format";

export const feeProfileKey = (asOf: string) => ["fee-profile", asOf] as const;

export function useActiveFeeProfile(asOf: string = todayIso()) {
  return useQuery({
    queryKey: feeProfileKey(asOf),
    queryFn: () => api.getActiveFeeProfile(asOf),
    retry: false,
  });
}

export function useCreateFeeProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NewFeeProfileVersionInput) => api.createFeeProfile(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fee-profile"] }),
  });
}

export function useReplaceFeeProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; input: NewFeeProfileVersionInput }) =>
      api.replaceFeeProfile(args.id, args.input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fee-profile"] }),
  });
}

export function useDeactivateFeeProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deactivateFeeProfile(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fee-profile"] }),
  });
}

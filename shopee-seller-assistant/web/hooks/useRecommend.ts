"use client";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/services/api";
import type {
  BreakEvenRequestInput,
  BreakEvenResult,
  RecommendRequestInput,
  RecommendResult,
} from "@/types/api";

export function useBreakEven() {
  return useMutation<BreakEvenResult, Error, BreakEvenRequestInput>({
    mutationFn: (input) => api.calculateBreakEven(input),
  });
}

export function useRecommend() {
  return useMutation<RecommendResult, Error, RecommendRequestInput>({
    mutationFn: (input) => api.recommend(input),
  });
}

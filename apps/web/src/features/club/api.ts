import {
  type CreatePrizeBody,
  type ListPrizeRedemptionsQuery,
  prizeListSchema,
  prizeRedemptionPageSchema,
  prizeSchema,
  ROUTES,
  rankingListSchema,
  type SealsReportQuery,
  sealsReportSchema,
  type UpdatePrizeBody,
} from "@arp/contracts";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiCall, apiRequest } from "@/shared/api";
import type { SaveInput } from "@/shared/lib/forms";

// Clube ARP (Fase 2): lojinha, trocas, ranking e selos por loja/produto.

export const clubApi = {
  prizes: (signal?: AbortSignal) => apiRequest(ROUTES.prizes.list, prizeListSchema, { signal }),
  createPrize: (body: CreatePrizeBody) => apiRequest(ROUTES.prizes.create, prizeSchema, { body }),
  updatePrize: (id: string, body: UpdatePrizeBody) =>
    apiRequest(ROUTES.prizes.update, prizeSchema, { params: { id }, body }),
  removePrize: (id: string) => apiCall(ROUTES.prizes.remove, { params: { id } }),
  redemptions: (query: ListPrizeRedemptionsQuery, signal?: AbortSignal) =>
    apiRequest(ROUTES.prizeRedemptions.list, prizeRedemptionPageSchema, { query, signal }),
  deliver: (id: string) => apiCall(ROUTES.prizeRedemptions.deliver, { params: { id } }),
  ranking: (signal?: AbortSignal) =>
    apiRequest(ROUTES.clubReports.ranking, rankingListSchema, { signal }),
  sealsReport: (query: SealsReportQuery, signal?: AbortSignal) =>
    apiRequest(ROUTES.clubReports.seals, sealsReportSchema, { query, signal }),
};

export const clubKeys = {
  prizes: ["club", "prizes"] as const,
  redemptions: (query: ListPrizeRedemptionsQuery) => ["club", "redemptions", query] as const,
  allRedemptions: ["club", "redemptions"] as const,
  ranking: ["club", "ranking"] as const,
  sealsReport: (query: SealsReportQuery) => ["club", "seals-report", query] as const,
};

export function usePrizes() {
  return useQuery({
    queryKey: clubKeys.prizes,
    queryFn: ({ signal }) => clubApi.prizes(signal),
    select: (r) => r.data,
  });
}

export function useRedemptions(query: ListPrizeRedemptionsQuery) {
  return useQuery({
    queryKey: clubKeys.redemptions(query),
    queryFn: ({ signal }) => clubApi.redemptions(query, signal),
    placeholderData: keepPreviousData,
  });
}

export function useRanking() {
  return useQuery({
    queryKey: clubKeys.ranking,
    queryFn: ({ signal }) => clubApi.ranking(signal),
    select: (r) => r.data,
  });
}

export function useSealsReport(query: SealsReportQuery) {
  return useQuery({
    queryKey: clubKeys.sealsReport(query),
    queryFn: ({ signal }) => clubApi.sealsReport(query, signal),
    select: (r) => r.data,
  });
}

export function useSavePrize() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveInput<CreatePrizeBody, UpdatePrizeBody>) =>
      "id" in input ? clubApi.updatePrize(input.id, input.body) : clubApi.createPrize(input.body),
    onSuccess: () => qc.invalidateQueries({ queryKey: clubKeys.prizes }),
  });
}

export function useDeletePrize() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: clubApi.removePrize,
    onSuccess: () => qc.invalidateQueries({ queryKey: clubKeys.prizes }),
  });
}

export function useDeliverRedemption() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: clubApi.deliver,
    onSuccess: () => qc.invalidateQueries({ queryKey: clubKeys.allRedemptions }),
  });
}

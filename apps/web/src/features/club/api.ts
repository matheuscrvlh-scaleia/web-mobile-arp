import {
  type CounterRedeemBody,
  type CreatePrizeBody,
  counterRedeemResultSchema,
  type ListPrizeRedemptionsQuery,
  prizeListSchema,
  prizeRedemptionPageSchema,
  prizeRedemptionSchema,
  prizeSchema,
  ROUTES,
  rankingListSchema,
  redemptionVisitorListSchema,
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
  cancelRedemption: (id: string) => apiCall(ROUTES.prizeRedemptions.cancel, { params: { id } }),
  deliverRedemption: (id: string) =>
    apiRequest(ROUTES.prizeRedemptions.deliver, prizeRedemptionSchema, { params: { id } }),
  redemptionVisitors: (q: string, signal?: AbortSignal) =>
    apiRequest(ROUTES.prizeRedemptions.visitors, redemptionVisitorListSchema, {
      query: { q },
      signal,
    }),
  counterRedeem: (body: CounterRedeemBody) =>
    apiRequest(ROUTES.prizeRedemptions.create, counterRedeemResultSchema, { body }),
  ranking: (signal?: AbortSignal) =>
    apiRequest(ROUTES.clubReports.ranking, rankingListSchema, { signal }),
  sealsReport: (query: SealsReportQuery, signal?: AbortSignal) =>
    apiRequest(ROUTES.clubReports.seals, sealsReportSchema, { query, signal }),
};

export const clubKeys = {
  prizes: ["club", "prizes"] as const,
  redemptions: (query: ListPrizeRedemptionsQuery) => ["club", "redemptions", query] as const,
  allRedemptions: ["club", "redemptions"] as const,
  redemptionVisitors: (q: string) => ["club", "redemption-visitors", q] as const,
  allRedemptionVisitors: ["club", "redemption-visitors"] as const,
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

/** Balcão: visitantes pelo nome, e-mail ou telefone (2+ letras). */
export function useRedemptionVisitors(q: string) {
  const term = q.trim();
  return useQuery({
    queryKey: clubKeys.redemptionVisitors(term),
    queryFn: ({ signal }) => clubApi.redemptionVisitors(term, signal),
    enabled: term.length >= 2,
    select: (r) => r.data,
    placeholderData: keepPreviousData,
  });
}

/** Troca no balcão: baixa Trevos e estoque e já sai entregue. */
export function useCounterRedeem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: clubApi.counterRedeem,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: clubKeys.prizes });
      void qc.invalidateQueries({ queryKey: clubKeys.allRedemptions });
      void qc.invalidateQueries({ queryKey: clubKeys.allRedemptionVisitors });
    },
  });
}

/** Mercado Local: entrega a troca feita no app (pendente → entregue). */
export function useDeliverRedemption() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: clubApi.deliverRedemption,
    onSuccess: () => void qc.invalidateQueries({ queryKey: clubKeys.allRedemptions }),
  });
}

/** Desfaz a troca: Trevos e estoque voltam. */
export function useCancelRedemption() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: clubApi.cancelRedemption,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: clubKeys.prizes });
      void qc.invalidateQueries({ queryKey: clubKeys.allRedemptions });
      void qc.invalidateQueries({ queryKey: clubKeys.allRedemptionVisitors });
    },
  });
}

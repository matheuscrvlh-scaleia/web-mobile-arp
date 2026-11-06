import {
  type DashboardDetailQuery,
  type DashboardQuery,
  dashboardDetailSchema,
  dashboardOverviewSchema,
  pendingSchema,
  ROUTES,
} from "@arp/contracts";
import { keepPreviousData, type QueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/shared/api";

export const dashboardApi = {
  overview: (query: DashboardQuery, signal?: AbortSignal) =>
    apiRequest(ROUTES.dashboard, dashboardOverviewSchema, { query, signal }),
  detail: (query: DashboardDetailQuery, signal?: AbortSignal) =>
    apiRequest(ROUTES.dashboardDetail, dashboardDetailSchema, { query, signal }),
  pending: (signal?: AbortSignal) => apiRequest(ROUTES.dashboardPending, pendingSchema, { signal }),
};

export const dashboardKeys = {
  all: ["dashboard"] as const,
  overview: (query: DashboardQuery) => [...dashboardKeys.all, "overview", query] as const,
  detail: (query: DashboardDetailQuery) => [...dashboardKeys.all, "detail", query] as const,
};

/** Chave das pendências (fora de "dashboard": o menu e o sino também usam). */
export const PENDING_KEY = ["pending"] as const;

/**
 * Pendências da pessoa: Dashboard, contadores do menu e o sino. Uma consulta
 * só, compartilhada; atualiza a cada minuto e depois de qualquer gravação
 * (ver query-client).
 */
export function usePending(enabled = true) {
  return useQuery({
    queryKey: PENDING_KEY,
    queryFn: ({ signal }) => dashboardApi.pending(signal),
    enabled,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

/** Indicadores do período (o período anterior vem junto, para a variação). */
export function useDashboardOverview(query: DashboardQuery) {
  return useQuery({
    queryKey: dashboardKeys.overview(query),
    queryFn: ({ signal }) => dashboardApi.overview(query, signal),
    placeholderData: keepPreviousData,
    // Painel ao vivo: atualiza sozinho a cada minuto enquanto aberto.
    refetchInterval: 60_000,
    staleTime: 60_000,
  });
}

const detailOptions = (query: DashboardDetailQuery) => ({
  queryKey: dashboardKeys.detail(query),
  queryFn: ({ signal }: { signal?: AbortSignal }) => dashboardApi.detail(query, signal),
  staleTime: 60_000,
});

/** De onde vem um indicador: pedido só com o modal aberto (ou na pré-carga). */
export function useDashboardDetail(query: DashboardDetailQuery | null) {
  return useQuery({
    ...detailOptions(query ?? { period: "30d", metric: "visitorsTotal" }),
    enabled: query !== null,
  });
}

/** Mouse parado ou foco no cartão: já pede, para o modal abrir pronto. */
export function prefetchDashboardDetail(qc: QueryClient, query: DashboardDetailQuery) {
  void qc.prefetchQuery(detailOptions(query));
}

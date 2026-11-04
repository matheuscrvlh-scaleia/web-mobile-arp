import {
  type DashboardDetailQuery,
  type DashboardQuery,
  dashboardDetailSchema,
  dashboardOverviewSchema,
  ROUTES,
} from "@arp/contracts";
import { keepPreviousData, type QueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/shared/api";

export const dashboardApi = {
  overview: (query: DashboardQuery, signal?: AbortSignal) =>
    apiRequest(ROUTES.dashboard, dashboardOverviewSchema, { query, signal }),
  detail: (query: DashboardDetailQuery, signal?: AbortSignal) =>
    apiRequest(ROUTES.dashboardDetail, dashboardDetailSchema, { query, signal }),
};

export const dashboardKeys = {
  all: ["dashboard"] as const,
  overview: (query: DashboardQuery) => [...dashboardKeys.all, "overview", query] as const,
  detail: (query: DashboardDetailQuery) => [...dashboardKeys.all, "detail", query] as const,
};

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

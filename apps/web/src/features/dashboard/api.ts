import { type DashboardQuery, dashboardOverviewSchema, ROUTES } from "@arp/contracts";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/shared/api";

export const dashboardApi = {
  overview: (query: DashboardQuery, signal?: AbortSignal) =>
    apiRequest(ROUTES.dashboard, dashboardOverviewSchema, { query, signal }),
};

export const dashboardKeys = {
  all: ["dashboard"] as const,
  overview: (query: DashboardQuery) => [...dashboardKeys.all, "overview", query] as const,
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

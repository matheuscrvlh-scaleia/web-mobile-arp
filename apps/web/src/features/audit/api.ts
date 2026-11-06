import {
  auditActorListSchema,
  auditLogPageSchema,
  type ListAuditLogsQuery,
  ROUTES,
} from "@arp/contracts";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/shared/api";

export const auditApi = {
  list: (query: Partial<ListAuditLogsQuery>, signal?: AbortSignal) =>
    apiRequest(ROUTES.auditLogs, auditLogPageSchema, { query, signal }),
  actors: (signal?: AbortSignal) =>
    apiRequest(ROUTES.auditActors, auditActorListSchema, { signal }),
};

export const auditKeys = {
  all: ["audit-logs"] as const,
  list: (query: Partial<ListAuditLogsQuery>) => [...auditKeys.all, "list", query] as const,
  actors: () => [...auditKeys.all, "actors"] as const,
};

export function useAuditLogs(query: Partial<ListAuditLogsQuery>) {
  return useQuery({
    queryKey: auditKeys.list(query),
    queryFn: ({ signal }) => auditApi.list(query, signal),
    placeholderData: keepPreviousData,
  });
}

/** Pessoas da equipe para o filtro "Quem". */
export function useAuditActors() {
  return useQuery({
    queryKey: auditKeys.actors(),
    queryFn: ({ signal }) => auditApi.actors(signal),
    staleTime: 5 * 60_000,
  });
}

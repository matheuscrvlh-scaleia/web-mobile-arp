import { auditLogPageSchema, type ListAuditLogsQuery, ROUTES } from "@arp/contracts";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/shared/api";

export const auditApi = {
  list: (query: Partial<ListAuditLogsQuery>, signal?: AbortSignal) =>
    apiRequest(ROUTES.auditLogs, auditLogPageSchema, { query, signal }),
};

export const auditKeys = {
  all: ["audit-logs"] as const,
  list: (query: Partial<ListAuditLogsQuery>) => [...auditKeys.all, "list", query] as const,
};

export function useAuditLogs(query: Partial<ListAuditLogsQuery>) {
  return useQuery({
    queryKey: auditKeys.list(query),
    queryFn: ({ signal }) => auditApi.list(query, signal),
    placeholderData: keepPreviousData,
  });
}

import {
  type ListVisitorsQuery,
  ROUTES,
  type UpdateVisitorStatusBody,
  type VisitorDetail,
  type VisitorSummary,
  visitorDetailSchema,
  visitorPageSchema,
  visitorSummarySchema,
} from "@arp/contracts";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, updateListItem } from "@/shared/api";

export const visitorsApi = {
  list: (query: Partial<ListVisitorsQuery>, signal?: AbortSignal) =>
    apiRequest(ROUTES.visitors.list, visitorPageSchema, { query, signal }),
  get: (id: string, signal?: AbortSignal) =>
    apiRequest(ROUTES.visitors.get, visitorDetailSchema, { params: { id }, signal }),
  /** Bloqueia (motivo obrigatório) ou desbloqueia. */
  updateStatus: (id: string, body: UpdateVisitorStatusBody) =>
    apiRequest(ROUTES.visitors.updateStatus, visitorDetailSchema, { params: { id }, body }),
};

export const visitorKeys = {
  all: ["visitors"] as const,
  lists: () => [...visitorKeys.all, "list"] as const,
  list: (query: Partial<ListVisitorsQuery>) => [...visitorKeys.lists(), query] as const,
  detail: (id: string) => [...visitorKeys.all, "detail", id] as const,
};

export function useVisitors(query: Partial<ListVisitorsQuery>, { enabled = true } = {}) {
  return useQuery({
    queryKey: visitorKeys.list(query),
    queryFn: ({ signal }) => visitorsApi.list(query, signal),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useVisitor(id: string | undefined) {
  return useQuery({
    queryKey: visitorKeys.detail(id ?? ""),
    queryFn: ({ signal }) => visitorsApi.get(id ?? "", signal),
    enabled: Boolean(id),
  });
}

/** Bloqueia ou desbloqueia: o DTO vira o detalhe na hora; as listas (filtro por situação) recarregam. */
export function useUpdateVisitorStatus(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateVisitorStatusBody) => visitorsApi.updateStatus(id, body),
    onSuccess: (visitor: VisitorDetail) => {
      qc.setQueryData(visitorKeys.detail(visitor.id), visitor);
      const summary = visitorSummarySchema.parse(visitor);
      updateListItem<VisitorSummary>(qc, visitorKeys.lists(), visitor.id, () => summary);
      return qc.invalidateQueries({ queryKey: visitorKeys.lists() });
    },
  });
}

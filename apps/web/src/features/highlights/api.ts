import {
  type CreateHighlightBody,
  type Highlight,
  highlightListSchema,
  highlightSchema,
  type ListHighlightsQuery,
  type ListOf,
  ROUTES,
  type UpdateHighlightBody,
} from "@arp/contracts";
import {
  keepPreviousData,
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiCall, apiRequest, updateListItem } from "@/shared/api";

export const highlightsApi = {
  list: (query: Partial<ListHighlightsQuery>, signal?: AbortSignal) =>
    apiRequest(ROUTES.highlights.list, highlightListSchema, { query, signal }),
  get: (id: string, signal?: AbortSignal) =>
    apiRequest(ROUTES.highlights.get, highlightSchema, { params: { id }, signal }),
  create: (body: CreateHighlightBody) =>
    apiRequest(ROUTES.highlights.create, highlightSchema, { body }),
  update: (id: string, body: UpdateHighlightBody) =>
    apiRequest(ROUTES.highlights.update, highlightSchema, { params: { id }, body }),
  /** Nova ordem do carrossel: todos os ids (204). */
  reorder: (ids: string[]) => apiCall(ROUTES.highlights.reorder, { body: { ids } }),
  remove: (id: string) => apiCall(ROUTES.highlights.remove, { params: { id } }),
};

export const highlightKeys = {
  all: ["highlights"] as const,
  lists: () => [...highlightKeys.all, "list"] as const,
  list: (query: Partial<ListHighlightsQuery>) => [...highlightKeys.lists(), query] as const,
  detail: (id: string) => [...highlightKeys.all, "detail", id] as const,
};

/** Destaques na ordem do carrossel (lista completa, filtros opcionais). */
export function useHighlights(query: Partial<ListHighlightsQuery> = {}) {
  return useQuery({
    queryKey: highlightKeys.list(query),
    queryFn: ({ signal }) => highlightsApi.list(query, signal),
    select: (r) => r.data,
    placeholderData: keepPreviousData,
  });
}

/** Um destaque (GET /highlights/:id); vindo da lista, já abre com o item dela. */
export function useHighlight(id: string | undefined) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: highlightKeys.detail(id ?? ""),
    queryFn: ({ signal }) => highlightsApi.get(id ?? "", signal),
    placeholderData: id ? findInLists(qc, id) : undefined,
    enabled: Boolean(id),
  });
}

function findInLists(qc: QueryClient, id: string): Highlight | undefined {
  for (const [, list] of qc.getQueriesData<ListOf<Highlight>>({
    queryKey: highlightKeys.lists(),
  })) {
    const found = list?.data.find((h) => h.id === id);
    if (found) return found;
  }
  return undefined;
}

/**
 * Destaque salvo: o DTO vira o detalhe e o item das listas na hora. Fase,
 * filtros e ordem dependem do servidor: as listas recarregam.
 */
function highlightSaved(qc: QueryClient, highlight: Highlight) {
  qc.setQueryData(highlightKeys.detail(highlight.id), highlight);
  updateListItem<Highlight>(qc, highlightKeys.lists(), highlight.id, () => highlight);
  return qc.invalidateQueries({ queryKey: highlightKeys.lists() });
}

export function useCreateHighlight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: highlightsApi.create,
    onSuccess: (h) => highlightSaved(qc, h),
  });
}

/** PATCH só do que mudou (destino, patrocínio e período vão completos). */
export function useUpdateHighlight(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateHighlightBody) => highlightsApi.update(id, body),
    onSuccess: (h) => highlightSaved(qc, h),
  });
}

export function useDeleteHighlight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: highlightsApi.remove,
    // Só as listas: o detalhe apagado ainda está na tela até a navegação de volta.
    onSuccess: () => qc.invalidateQueries({ queryKey: highlightKeys.lists() }),
  });
}

/**
 * Nova ordem do carrossel (todos os ids). Otimista na lista sem filtro: o
 * cartão fica onde foi solto enquanto salva; se falhar, volta.
 */
export function useReorderHighlights() {
  const qc = useQueryClient();
  const key = highlightKeys.list({});
  return useMutation({
    mutationFn: highlightsApi.reorder,
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: highlightKeys.all });
      const previous = qc.getQueryData<ListOf<Highlight>>(key);
      if (previous) {
        const byId = new Map(previous.data.map((h) => [h.id, h]));
        const data = ids.flatMap((id, i) => {
          const h = byId.get(id);
          return h ? [{ ...h, sortOrder: i }] : [];
        });
        qc.setQueryData(key, { data });
      }
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: highlightKeys.all }),
  });
}

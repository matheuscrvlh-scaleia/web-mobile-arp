import {
  type CreateEventCategoryBody,
  type Event,
  eventCategoryListSchema,
  eventCategorySchema,
  eventOccurrencesSchema,
  eventPageSchema,
  eventSchema,
  type ListEventsQuery,
  ROUTES,
  type SyncSiteEventsBody,
  syncSiteEventsResultSchema,
  type UpdateEventBody,
  type UpdateEventCategoryBody,
} from "@arp/contracts";
import {
  keepPreviousData,
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiCall, apiRequest, updateListItem } from "@/shared/api";
import type { SaveInput } from "@/shared/lib/forms";

export const eventsApi = {
  list: (query: Partial<ListEventsQuery>, signal?: AbortSignal) =>
    apiRequest(ROUTES.events.list, eventPageSchema, { query, signal }),
  occurrences: (from: string, to: string, signal?: AbortSignal) =>
    apiRequest(ROUTES.events.occurrences, eventOccurrencesSchema, { query: { from, to }, signal }),
  get: (id: string, signal?: AbortSignal) =>
    apiRequest(ROUTES.events.get, eventSchema, { params: { id }, signal }),
  /** Só a situação (mostrar ou não no app): o resto vem do site. */
  update: (id: string, body: UpdateEventBody) =>
    apiRequest(ROUTES.events.update, eventSchema, { params: { id }, body }),
  archive: (id: string) => apiRequest(ROUTES.events.archive, eventSchema, { params: { id } }),
  unarchive: (id: string) => apiRequest(ROUTES.events.unarchive, eventSchema, { params: { id } }),
  /** Deixa a agenda igual ao site (cria, atualiza e apaga). */
  syncSite: (body: SyncSiteEventsBody) =>
    apiRequest(ROUTES.events.syncSite, syncSiteEventsResultSchema, { body }),
};

export const eventCategoriesApi = {
  list: (signal?: AbortSignal) =>
    apiRequest(ROUTES.eventCategories.list, eventCategoryListSchema, { signal }),
  create: (body: CreateEventCategoryBody) =>
    apiRequest(ROUTES.eventCategories.create, eventCategorySchema, { body }),
  update: (id: string, body: UpdateEventCategoryBody) =>
    apiRequest(ROUTES.eventCategories.update, eventCategorySchema, { params: { id }, body }),
  remove: (id: string) => apiCall(ROUTES.eventCategories.remove, { params: { id } }),
};

export const eventKeys = {
  all: ["events"] as const,
  lists: () => [...eventKeys.all, "list"] as const,
  list: (query: Partial<ListEventsQuery>) => [...eventKeys.lists(), query] as const,
  detail: (id: string) => [...eventKeys.all, "detail", id] as const,
  occurrences: (from: string, to: string) => [...eventKeys.all, "occurrences", from, to] as const,
};

export const eventCategoryKeys = {
  all: ["event-categories"] as const,
  list: () => [...eventCategoryKeys.all, "list"] as const,
};

export function useEvents(query: Partial<ListEventsQuery>, { enabled = true } = {}) {
  return useQuery({
    queryKey: eventKeys.list(query),
    queryFn: ({ signal }) => eventsApi.list(query, signal),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useEvent(id: string | undefined) {
  return useQuery({
    queryKey: eventKeys.detail(id ?? ""),
    queryFn: ({ signal }) => eventsApi.get(id ?? "", signal),
    enabled: Boolean(id),
  });
}

/** Calendário: em quais dias do intervalo cada evento acontece. */
export function useEventOccurrences(from: string, to: string) {
  return useQuery({
    queryKey: eventKeys.occurrences(from, to),
    queryFn: ({ signal }) => eventsApi.occurrences(from, to, signal),
    select: (r) => r.data,
    placeholderData: keepPreviousData,
  });
}

/**
 * Listas, calendário e contagens das categorias dependem do evento, e ele
 * aparece em destaques e desafios (alvo / vínculo): tudo isso recarrega.
 */
const invalidateRelated = (qc: QueryClient) =>
  Promise.all([
    qc.invalidateQueries({ queryKey: eventKeys.lists() }),
    qc.invalidateQueries({ queryKey: [...eventKeys.all, "occurrences"] }),
    qc.invalidateQueries({ queryKey: eventCategoryKeys.all }),
    qc.invalidateQueries({ queryKey: ["highlights"] }),
    qc.invalidateQueries({ queryKey: ["challenges"] }),
  ]);

/** Evento salvo: o DTO vira o detalhe e o item das listas na hora. */
function eventSaved(qc: QueryClient, event: Event) {
  qc.setQueryData(eventKeys.detail(event.id), event);
  updateListItem<Event>(qc, eventKeys.lists(), event.id, () => event);
  return invalidateRelated(qc);
}

/** Mostrar ou não no app (status). */
export function useUpdateEvent(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateEventBody) => eventsApi.update(id, body),
    onSuccess: (event) => eventSaved(qc, event),
  });
}

/** Arquivar / desarquivar (some das listas e do calendário; volta pausado ou como estava). */
export function useArchiveEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
      archived ? eventsApi.archive(id) : eventsApi.unarchive(id),
    onSuccess: (event) => eventSaved(qc, event),
  });
}

export function useSyncSiteEvents() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: eventsApi.syncSite, onSuccess: () => invalidateRelated(qc) });
}

/* Categorias de evento ---------------------------------------------------- */

export function useEventCategories({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: eventCategoryKeys.list(),
    queryFn: ({ signal }) => eventCategoriesApi.list(signal),
    select: (r) => r.data,
    staleTime: 5 * 60_000,
    enabled,
  });
}

/** Cria (corpo completo) ou edita (só os campos que mudaram). Categoria aparece nos eventos. */
export function useSaveEventCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveInput<CreateEventCategoryBody, UpdateEventCategoryBody>) =>
      "id" in input
        ? eventCategoriesApi.update(input.id, input.body)
        : eventCategoriesApi.create(input.body),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: eventCategoryKeys.all }),
        qc.invalidateQueries({ queryKey: eventKeys.all }),
      ]),
  });
}

/** Só apaga categoria sem eventos (a API devolve CONFLICT). */
export function useDeleteEventCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: eventCategoriesApi.remove,
    onSuccess: () => qc.invalidateQueries({ queryKey: eventCategoryKeys.all }),
  });
}

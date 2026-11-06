import {
  audienceEstimateSchema,
  type CreateNotificationBody,
  type ListNotificationsQuery,
  type NotificationAudience,
  type Paginated,
  type PushNotification,
  pushNotificationPageSchema,
  pushNotificationSchema,
  ROUTES,
  type UpdateNotificationBody,
} from "@arp/contracts";
import {
  keepPreviousData,
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiCall, apiRequest, updateListItem } from "@/shared/api";

/** Público para estimar: a loja (seguidores) ou o evento (interessados) quando o público pede. */
export type AudienceQuery = {
  audience: NotificationAudience;
  storeId?: string;
  eventId?: string;
};

/** O público está completo (tem a loja ou o evento que ele pede). */
export const audienceReady = ({ audience, storeId, eventId }: AudienceQuery) =>
  audience === "store_followers"
    ? Boolean(storeId)
    : audience === "event_interested"
      ? Boolean(eventId)
      : true;

export const notificationsApi = {
  list: (query: Partial<ListNotificationsQuery>, signal?: AbortSignal) =>
    apiRequest(ROUTES.notifications.list, pushNotificationPageSchema, { query, signal }),
  get: (id: string, signal?: AbortSignal) =>
    apiRequest(ROUTES.notifications.get, pushNotificationSchema, { params: { id }, signal }),
  estimate: (target: AudienceQuery, signal?: AbortSignal) =>
    apiRequest(ROUTES.notifications.estimate, audienceEstimateSchema, {
      query: target,
      signal,
    }),
  create: (body: CreateNotificationBody) =>
    apiRequest(ROUTES.notifications.create, pushNotificationSchema, { body }),
  update: (id: string, body: UpdateNotificationBody) =>
    apiRequest(ROUTES.notifications.update, pushNotificationSchema, { params: { id }, body }),
  /** Agenda (com scheduledAt) ou envia agora (sem). */
  schedule: (id: string, scheduledAt: string | null) =>
    apiRequest(ROUTES.notifications.schedule, pushNotificationSchema, {
      params: { id },
      body: scheduledAt ? { scheduledAt } : {},
    }),
  cancel: (id: string) =>
    apiRequest(ROUTES.notifications.cancel, pushNotificationSchema, { params: { id } }),
  toDraft: (id: string) =>
    apiRequest(ROUTES.notifications.toDraft, pushNotificationSchema, { params: { id } }),
  remove: (id: string) => apiCall(ROUTES.notifications.remove, { params: { id } }),
};

export const notificationKeys = {
  all: ["notifications"] as const,
  lists: () => [...notificationKeys.all, "list"] as const,
  list: (query: Partial<ListNotificationsQuery>) => [...notificationKeys.lists(), query] as const,
  detail: (id: string) => [...notificationKeys.all, "detail", id] as const,
  estimate: ({ audience, storeId, eventId }: AudienceQuery) =>
    [...notificationKeys.all, "estimate", audience, storeId ?? null, eventId ?? null] as const,
};

export function useNotifications(query: Partial<ListNotificationsQuery>) {
  return useQuery({
    queryKey: notificationKeys.list(query),
    queryFn: ({ signal }) => notificationsApi.list(query, signal),
    placeholderData: keepPreviousData,
  });
}

/** Uma notificação (GET /notifications/:id); vindo da lista, já abre com o item dela. */
export function useNotification(id: string | undefined) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: notificationKeys.detail(id ?? ""),
    queryFn: ({ signal }) => notificationsApi.get(id ?? "", signal),
    placeholderData: id ? findInLists(qc, id) : undefined,
    enabled: Boolean(id),
  });
}

function findInLists(qc: QueryClient, id: string): PushNotification | undefined {
  for (const [, page] of qc.getQueriesData<Paginated<PushNotification>>({
    queryKey: notificationKeys.lists(),
  })) {
    const found = page?.data.find((n) => n.id === id);
    if (found) return found;
  }
  return undefined;
}

/** Quantas pessoas recebem (só calcula quando o público está completo). */
export function useAudienceEstimate(target: AudienceQuery) {
  return useQuery({
    queryKey: notificationKeys.estimate(target),
    queryFn: ({ signal }) => notificationsApi.estimate(target, signal),
    select: (r) => r.recipientsCount,
    enabled: audienceReady(target),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}

/**
 * Notificação salva: o DTO vira o "detalhe" e o item das listas na hora;
 * as listas (por situação) recarregam.
 */
function notificationSaved(qc: QueryClient, n: PushNotification) {
  qc.setQueryData(notificationKeys.detail(n.id), n);
  updateListItem<PushNotification>(qc, notificationKeys.lists(), n.id, () => n);
  return qc.invalidateQueries({ queryKey: notificationKeys.lists() });
}

/** Cria o rascunho e devolve a notificação (para agendar ou enviar em seguida). */
export function useCreateNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: notificationsApi.create,
    onSuccess: (n) => notificationSaved(qc, n),
  });
}

export function useUpdateNotification(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateNotificationBody) => notificationsApi.update(id, body),
    onSuccess: (n) => notificationSaved(qc, n),
  });
}

/** Agenda (com scheduledAt) ou envia agora (sem). */
export function useScheduleNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, scheduledAt }: { id: string; scheduledAt: string | null }) =>
      notificationsApi.schedule(id, scheduledAt),
    onSuccess: (n) => notificationSaved(qc, n),
  });
}

/** Cancela uma notificação agendada (antes do envio). */
export function useCancelNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: notificationsApi.cancel,
    onSuccess: (n) => notificationSaved(qc, n),
  });
}

/** Cancelada volta para rascunho (editar e agendar de novo). */
export function useNotificationToDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: notificationsApi.toDraft,
    onSuccess: (n) => notificationSaved(qc, n),
  });
}

/** Exclui rascunho ou cancelada (enviada fica no histórico). */
export function useDeleteNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: notificationsApi.remove,
    onSuccess: (_, id) => {
      qc.removeQueries({ queryKey: notificationKeys.detail(id) });
      return qc.invalidateQueries({ queryKey: notificationKeys.lists() });
    },
  });
}

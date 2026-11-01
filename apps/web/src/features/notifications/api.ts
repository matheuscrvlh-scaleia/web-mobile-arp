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
import { apiRequest, updateListItem } from "@/shared/api";

export const notificationsApi = {
  list: (query: Partial<ListNotificationsQuery>, signal?: AbortSignal) =>
    apiRequest(ROUTES.notifications.list, pushNotificationPageSchema, { query, signal }),
  get: (id: string, signal?: AbortSignal) =>
    apiRequest(ROUTES.notifications.get, pushNotificationSchema, { params: { id }, signal }),
  estimate: (audience: NotificationAudience, storeId: string | undefined, signal?: AbortSignal) =>
    apiRequest(ROUTES.notifications.estimate, audienceEstimateSchema, {
      query: { audience, storeId },
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
};

export const notificationKeys = {
  all: ["notifications"] as const,
  lists: () => [...notificationKeys.all, "list"] as const,
  list: (query: Partial<ListNotificationsQuery>) => [...notificationKeys.lists(), query] as const,
  detail: (id: string) => [...notificationKeys.all, "detail", id] as const,
  estimate: (audience: NotificationAudience, storeId: string | undefined) =>
    [...notificationKeys.all, "estimate", audience, storeId ?? null] as const,
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
export function useAudienceEstimate(audience: NotificationAudience, storeId: string | undefined) {
  const ready = audience !== "store_followers" || Boolean(storeId);
  return useQuery({
    queryKey: notificationKeys.estimate(audience, storeId),
    queryFn: ({ signal }) => notificationsApi.estimate(audience, storeId, signal),
    select: (r) => r.recipientsCount,
    enabled: ready,
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

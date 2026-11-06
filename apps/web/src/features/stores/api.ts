import {
  type BulkUpdateStoresBody,
  bulkUpdateStoresResponseSchema,
  type CreateStoreBody,
  type ListStoresQuery,
  type MetricsPeriod,
  ROUTES,
  type StoreDetail,
  type StorePin,
  type StoreSummary,
  storeDetailSchema,
  storeMetricsSchema,
  storeOptionListSchema,
  storePageSchema,
  storeSummarySchema,
  type UpdateStoreBody,
  type UpdateStoreLocationBody,
} from "@arp/contracts";
import {
  keepPreviousData,
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { floorKeys } from "@/features/map";
import { apiCall, apiRequest, snapshotQueries, updateListItem } from "@/shared/api";

/* Chamadas ---------------------------------------------------------------- */

export const storesApi = {
  list: (query: Partial<ListStoresQuery>, signal?: AbortSignal) =>
    apiRequest(ROUTES.stores.list, storePageSchema, { query, signal }),
  options: (signal?: AbortSignal) =>
    apiRequest(ROUTES.stores.options, storeOptionListSchema, { signal }),
  get: (id: string, signal?: AbortSignal) =>
    apiRequest(ROUTES.stores.get, storeDetailSchema, { params: { id }, signal }),
  metrics: (id: string, period: MetricsPeriod, signal?: AbortSignal) =>
    apiRequest(ROUTES.stores.metrics, storeMetricsSchema, {
      params: { id },
      query: { period },
      signal,
    }),
  create: (body: CreateStoreBody) => apiRequest(ROUTES.stores.create, storeDetailSchema, { body }),
  /** PATCH parcial: só os campos que mudaram. */
  update: (id: string, body: UpdateStoreBody) =>
    apiRequest(ROUTES.stores.update, storeDetailSchema, { params: { id }, body }),
  /** Pino no mapa (permissão map.manage, separada da edição da loja). */
  setLocation: (id: string, body: UpdateStoreLocationBody) =>
    apiRequest(ROUTES.stores.updateLocation, storeDetailSchema, { params: { id }, body }),
  deactivate: (id: string) =>
    apiRequest(ROUTES.stores.deactivate, storeDetailSchema, { params: { id } }),
  /** Excluir de vez (só loja sem histórico; com histórico a API responde 409). */
  remove: (id: string) => apiCall(ROUTES.stores.remove, { params: { id } }),
  bulkUpdate: (body: BulkUpdateStoresBody) =>
    apiRequest(ROUTES.stores.bulkUpdate, bulkUpdateStoresResponseSchema, { body }),
};

/* Cache -------------------------------------------------------------------- */

export const storeKeys = {
  all: ["stores"] as const,
  lists: () => [...storeKeys.all, "list"] as const,
  list: (query: Partial<ListStoresQuery>) => [...storeKeys.lists(), query] as const,
  options: () => [...storeKeys.all, "options"] as const,
  details: () => [...storeKeys.all, "detail"] as const,
  detail: (id: string) => [...storeKeys.details(), id] as const,
  metrics: (id: string, period: MetricsPeriod) =>
    [...storeKeys.all, "metrics", id, period] as const,
};

/** O DTO devolvido pela escrita vira o detalhe e o item das listas (sem refetch). */
function storeSaved(qc: QueryClient, store: StoreDetail) {
  qc.setQueryData(storeKeys.detail(store.id), store);
  // O schema do resumo descarta os campos que só o detalhe tem.
  const summary = storeSummarySchema.parse(store);
  updateListItem<StoreSummary>(qc, storeKeys.lists(), store.id, () => summary);
}

/** Listas e o select de lojas dependem de nome, status, categoria…: recarregam. */
const invalidateLists = (qc: QueryClient) =>
  Promise.all([
    qc.invalidateQueries({ queryKey: storeKeys.lists() }),
    qc.invalidateQueries({ queryKey: storeKeys.options() }),
  ]);

/* Leitura ------------------------------------------------------------------ */

/** Lista paginada com filtros (a página anterior fica na tela enquanto a nova chega). */
export function useStores(query: Partial<ListStoresQuery>, { enabled = true } = {}) {
  return useQuery({
    queryKey: storeKeys.list(query),
    queryFn: ({ signal }) => storesApi.list(query, signal),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** Lojas ativas para selects (lista curta, muda pouco). */
export function useStoreOptions({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: storeKeys.options(),
    queryFn: ({ signal }) => storesApi.options(signal),
    select: (r) => r.data,
    staleTime: 5 * 60_000,
    enabled,
  });
}

export function useStore(id: string | undefined) {
  return useQuery({
    queryKey: storeKeys.detail(id ?? ""),
    queryFn: ({ signal }) => storesApi.get(id ?? "", signal),
    enabled: Boolean(id),
  });
}

export function useStoreMetrics(id: string, period: MetricsPeriod, { enabled = true } = {}) {
  return useQuery({
    queryKey: storeKeys.metrics(id, period),
    queryFn: ({ signal }) => storesApi.metrics(id, period, signal),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    enabled,
  });
}

/* Escrita ------------------------------------------------------------------ */

export function useCreateStore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: storesApi.create,
    onSuccess: (store) => {
      qc.setQueryData(storeKeys.detail(store.id), store);
      return invalidateLists(qc);
    },
  });
}

/** Edita parte da loja (dados, horários, status): manda só o que mudou. */
export function useUpdateStore(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateStoreBody) => storesApi.update(id, body),
    onSuccess: (store, body) => {
      storeSaved(qc, store);
      return Promise.all([
        invalidateLists(qc),
        // Trocou de andar: mudam a contagem dos andares e os pinos dos dois mapas.
        body.floorId && qc.invalidateQueries({ queryKey: floorKeys.all }),
      ]);
    },
  });
}

/** PATCH de qualquer loja (ex.: o mapa corrige o bloco); os pinos recarregam. */
export function usePatchStore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateStoreBody }) => storesApi.update(id, body),
    onSuccess: (store) => {
      storeSaved(qc, store);
      return Promise.all([
        invalidateLists(qc),
        qc.invalidateQueries({ queryKey: floorKeys.allPins() }),
      ]);
    },
  });
}

/** Desativar: some do app, o histórico continua (Reativar = PATCH status). */
export function useDeactivateStore(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => storesApi.deactivate(id),
    onSuccess: (store) => {
      storeSaved(qc, store);
      return invalidateLists(qc);
    },
  });
}

/** Excluir de vez a loja sem histórico (cadastro por engano). */
export function useDeleteStore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: storesApi.remove,
    onSuccess: (_v, id) => {
      qc.removeQueries({ queryKey: storeKeys.detail(id) });
      return Promise.all([invalidateLists(qc), qc.invalidateQueries({ queryKey: floorKeys.all })]);
    },
  });
}

/** Mesma mudança em várias lojas (categoria, bloco, andar, situação). */
export function useBulkUpdateStores() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: storesApi.bulkUpdate,
    // Categoria/bloco/andar mudam as contagens dos cadastros e os pinos do mapa.
    onSuccess: () =>
      Promise.all(
        [storeKeys.all, floorKeys.all, ["store-categories"], ["blocks"]].map((queryKey) =>
          qc.invalidateQueries({ queryKey }),
        ),
      ),
  });
}

/* Mapa --------------------------------------------------------------------- */

const LOCATION_MUTATION = [...storeKeys.all, "location"] as const;

/**
 * Posiciona (ou tira do mapa) qualquer loja: PUT /stores/:id/location.
 * Otimista nos pinos do mapa (o pino fica onde foi solto enquanto salva; se
 * falhar, volta). Só recarrega os pinos quando não há outro arraste
 * salvando, para uma resposta antiga não puxar um pino de volta.
 */
export function useSetStoreLocation() {
  const qc = useQueryClient();
  const pins = floorKeys.allPins();
  return useMutation({
    mutationKey: LOCATION_MUTATION,
    mutationFn: ({ id, body }: { id: string; body: UpdateStoreLocationBody }) =>
      storesApi.setLocation(id, body),
    onMutate: async ({ id, body }) => {
      await qc.cancelQueries({ queryKey: pins });
      const rollback = snapshotQueries(qc, pins);
      updateListItem<StorePin>(qc, pins, id, (s) => ({ ...s, mapX: body.mapX, mapY: body.mapY }));
      return { rollback };
    },
    onError: (_e, _v, ctx) => ctx?.rollback(),
    onSuccess: (store, { body }) => {
      storeSaved(qc, store);
      updateListItem<StorePin>(qc, pins, store.id, (s) => ({
        ...s,
        mapX: store.mapX,
        mapY: store.mapY,
      }));
      // Trocou de andar: a contagem "N lojas" de cada andar muda.
      if (body.floorId) return qc.invalidateQueries({ queryKey: floorKeys.list() });
    },
    onSettled: () => {
      if (qc.isMutating({ mutationKey: LOCATION_MUTATION }) === 1) {
        return qc.invalidateQueries({ queryKey: pins });
      }
    },
  });
}

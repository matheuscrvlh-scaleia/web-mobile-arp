import {
  type CreateFloorBody,
  type CreateMapPointBody,
  type Floor,
  floorListSchema,
  floorSchema,
  type ListOf,
  type MapPoint,
  mapPointListSchema,
  mapPointSchema,
  ROUTES,
  type StorePin,
  storePinListSchema,
  type UpdateFloorBody,
  type UpdateMapPointBody,
} from "@arp/contracts";
import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiCall, apiRequest, snapshotQueries, updateListItem } from "@/shared/api";
import type { SaveInput } from "@/shared/lib/forms";

/* Chamadas ----------------------------------------------------------------- */

export const floorsApi = {
  list: (signal?: AbortSignal) => apiRequest(ROUTES.floors.list, floorListSchema, { signal }),
  /** Todas as lojas do andar (com e sem posição), sem paginação. */
  pins: (id: string, signal?: AbortSignal) =>
    apiRequest(ROUTES.floors.pins, storePinListSchema, { params: { id }, signal }),
  create: (body: CreateFloorBody) => apiRequest(ROUTES.floors.create, floorSchema, { body }),
  /** PATCH parcial (ex.: só o desenho, só o nome). */
  update: (id: string, body: UpdateFloorBody) =>
    apiRequest(ROUTES.floors.update, floorSchema, { params: { id }, body }),
  remove: (id: string) => apiCall(ROUTES.floors.remove, { params: { id } }),
};

export const mapPointsApi = {
  list: (floorId: string, signal?: AbortSignal) =>
    apiRequest(ROUTES.mapPoints.list, mapPointListSchema, { query: { floorId }, signal }),
  create: (body: CreateMapPointBody) =>
    apiRequest(ROUTES.mapPoints.create, mapPointSchema, { body }),
  update: (id: string, body: UpdateMapPointBody) =>
    apiRequest(ROUTES.mapPoints.update, mapPointSchema, { params: { id }, body }),
  remove: (id: string) => apiCall(ROUTES.mapPoints.remove, { params: { id } }),
};

/* Cache -------------------------------------------------------------------- */

export const floorKeys = {
  all: ["floors"] as const,
  list: () => [...floorKeys.all, "list"] as const,
  allPins: () => [...floorKeys.all, "pins"] as const,
  pins: (floorId: string) => [...floorKeys.allPins(), floorId] as const,
};

export const mapPointKeys = {
  all: ["map-points"] as const,
  list: (floorId: string) => [...mapPointKeys.all, "list", floorId] as const,
};

/** Andar salvo (DTO da API) entra na lista em cache na hora. */
function floorSaved(qc: QueryClient, floor: Floor) {
  qc.setQueryData<ListOf<Floor>>(floorKeys.list(), (old) => {
    if (!old) return old;
    const exists = old.data.some((f) => f.id === floor.id);
    return {
      data: exists ? old.data.map((f) => (f.id === floor.id ? floor : f)) : [...old.data, floor],
    };
  });
}

/* Andares ------------------------------------------------------------------ */

const byLevel = (r: ListOf<Floor>) => [...r.data].sort((a, b) => a.level - b.level);

/** Andares por nível (subsolo, térreo, 1º, 2º…); o seletor "elevador" inverte. */
export function useFloors({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: floorKeys.list(),
    queryFn: ({ signal }) => floorsApi.list(signal),
    select: byLevel,
    staleTime: 5 * 60_000,
    enabled,
  });
}

/** Cria (corpo completo) ou edita (só os campos que mudaram). */
export function useSaveFloor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveInput<CreateFloorBody, UpdateFloorBody>) =>
      "id" in input ? floorsApi.update(input.id, input.body) : floorsApi.create(input.body),
    onSuccess: (floor) => floorSaved(qc, floor),
  });
}

/** Salva só o desenho do andar (PATCH { layout }). */
export function useSaveFloorLayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, layout }: { id: string; layout: Floor["layout"] }) =>
      floorsApi.update(id, { layout }),
    onSuccess: (floor) => floorSaved(qc, floor),
  });
}

export function useDeleteFloor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: floorsApi.remove,
    onSuccess: () => qc.invalidateQueries({ queryKey: floorKeys.all }),
  });
}

/* Lojas no mapa ------------------------------------------------------------ */

/** Loja com pino no desenho (as sem posição ficam em `unplaced`). */
export interface PlacedPin {
  store: StorePin;
  x: number;
  y: number;
}

/** Separa as lojas em "com pino" e "sem lugar" (estável: só refaz quando a lista muda). */
function toPins({ data }: ListOf<StorePin>) {
  const pins: PlacedPin[] = [];
  const unplaced: StorePin[] = [];
  for (const store of data) {
    if (store.mapX !== null && store.mapY !== null) {
      pins.push({ store, x: store.mapX, y: store.mapY });
    } else {
      unplaced.push(store);
    }
  }
  return { pins, unplaced, total: data.length };
}

/**
 * Todas as lojas de um andar com a posição no mapa (GET /floors/:id/pins,
 * uma chamada só, sem o teto de página da listagem de lojas).
 */
export function useFloorPins(floorId: string | undefined) {
  const query = useQuery({
    queryKey: floorKeys.pins(floorId ?? ""),
    queryFn: ({ signal }) => floorsApi.pins(floorId ?? "", signal),
    select: toPins,
    enabled: Boolean(floorId),
  });
  return {
    pins: query.data?.pins ?? [],
    unplaced: query.data?.unplaced ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    error: query.error,
    refetch: () => void query.refetch(),
  };
}

/* Pontos de referência ----------------------------------------------------- */

export function useMapPoints(floorId: string | undefined) {
  return useQuery({
    queryKey: mapPointKeys.list(floorId ?? ""),
    queryFn: ({ signal }) => mapPointsApi.list(floorId ?? "", signal),
    select: (r) => r.data,
    staleTime: 60_000,
    enabled: Boolean(floorId),
  });
}

export function useCreateMapPoint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: mapPointsApi.create,
    onSuccess: (point) =>
      qc.setQueryData<ListOf<MapPoint>>(mapPointKeys.list(point.floorId), (old) =>
        old ? { data: [...old.data, point] } : old,
      ),
  });
}

/**
 * Edita um ponto (arrastar, renomear). Otimista: o pino fica onde foi solto
 * enquanto salva; se falhar, volta. A resposta (DTO) fica no cache.
 */
export function useUpdateMapPoint(floorId: string) {
  const qc = useQueryClient();
  const key = mapPointKeys.list(floorId);
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateMapPointBody }) =>
      mapPointsApi.update(id, body),
    onMutate: async ({ id, body }) => {
      await qc.cancelQueries({ queryKey: key });
      const rollback = snapshotQueries(qc, key);
      updateListItem<MapPoint>(qc, key, id, (p) => ({ ...p, ...body }));
      return { rollback };
    },
    onError: (_e, _v, ctx) => ctx?.rollback(),
    onSuccess: (point) => updateListItem<MapPoint>(qc, key, point.id, () => point),
  });
}

export function useDeleteMapPoint(floorId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: mapPointsApi.remove,
    onSuccess: () => qc.invalidateQueries({ queryKey: mapPointKeys.list(floorId) }),
  });
}

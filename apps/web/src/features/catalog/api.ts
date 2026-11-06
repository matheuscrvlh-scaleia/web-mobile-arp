import {
  type Block,
  blockListSchema,
  blockSchema,
  type CreateBlockBody,
  type CreateStoreCategoryBody,
  type ListOf,
  ROUTES,
  type StoreCategory,
  storeCategoryListSchema,
  storeCategorySchema,
  type UpdateBlockBody,
  type UpdateStoreCategoryBody,
} from "@arp/contracts";
import { type QueryKey, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { storeKeys } from "@/features/stores";
import { apiCall, apiRequest } from "@/shared/api";
import type { SaveInput } from "@/shared/lib/forms";

// Cadastros pequenos (lista completa, sem paginação): categorias de loja e
// blocos. Mudar um deles mexe nos filtros e cartões das lojas, então as
// escritas também invalidam as lojas.

export const categoriesApi = {
  list: (signal?: AbortSignal) =>
    apiRequest(ROUTES.storeCategories.list, storeCategoryListSchema, { signal }),
  create: (body: CreateStoreCategoryBody) =>
    apiRequest(ROUTES.storeCategories.create, storeCategorySchema, { body }),
  update: (id: string, body: UpdateStoreCategoryBody) =>
    apiRequest(ROUTES.storeCategories.update, storeCategorySchema, { params: { id }, body }),
  /** `moveTo`: leva as lojas para outra categoria antes de apagar. */
  remove: (id: string, moveTo?: string) =>
    apiCall(ROUTES.storeCategories.remove, { params: { id }, query: { moveTo } }),
  reorder: (ids: string[]) => apiCall(ROUTES.storeCategories.reorder, { body: { ids } }),
};

export const blocksApi = {
  list: (signal?: AbortSignal) => apiRequest(ROUTES.blocks.list, blockListSchema, { signal }),
  create: (body: CreateBlockBody) => apiRequest(ROUTES.blocks.create, blockSchema, { body }),
  update: (id: string, body: UpdateBlockBody) =>
    apiRequest(ROUTES.blocks.update, blockSchema, { params: { id }, body }),
  /** `moveTo`: leva as lojas para outro bloco antes de apagar. */
  remove: (id: string, moveTo?: string) =>
    apiCall(ROUTES.blocks.remove, { params: { id }, query: { moveTo } }),
  reorder: (ids: string[]) => apiCall(ROUTES.blocks.reorder, { body: { ids } }),
};

export const categoryKeys = {
  all: ["store-categories"] as const,
  list: () => [...categoryKeys.all, "list"] as const,
};

export const blockKeys = {
  all: ["blocks"] as const,
  list: () => [...blockKeys.all, "list"] as const,
};

export function useStoreCategories({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: categoryKeys.list(),
    queryFn: ({ signal }) => categoriesApi.list(signal),
    select: (r) => r.data,
    staleTime: 5 * 60_000,
    enabled,
  });
}

export function useBlocks({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: blockKeys.list(),
    queryFn: ({ signal }) => blocksApi.list(signal),
    select: (r) => r.data,
    staleTime: 5 * 60_000,
    enabled,
  });
}

/** A lista do cadastro (ordem, contagens) e as lojas recarregam depois de qualquer escrita. */
function useInvalidate(key: QueryKey) {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: key }),
      qc.invalidateQueries({ queryKey: storeKeys.all }),
    ]);
}

/** Cria (corpo completo) ou edita (só os campos que mudaram). */
export function useSaveStoreCategory() {
  const invalidate = useInvalidate(categoryKeys.all);
  return useMutation({
    mutationFn: (input: SaveInput<CreateStoreCategoryBody, UpdateStoreCategoryBody>) =>
      "id" in input ? categoriesApi.update(input.id, input.body) : categoriesApi.create(input.body),
    onSuccess: invalidate,
  });
}

export function useDeleteStoreCategory() {
  const invalidate = useInvalidate(categoryKeys.all);
  return useMutation({
    mutationFn: ({ id, moveTo }: { id: string; moveTo?: string }) =>
      categoriesApi.remove(id, moveTo),
    onSuccess: invalidate,
  });
}

/**
 * Nova ordem (arrastar). Otimista: a lista fica na ordem nova enquanto
 * salva; se falhar, volta. `ids` são os de um dos 3 tipos.
 */
export function useReorderStoreCategories() {
  const qc = useQueryClient();
  const invalidate = useInvalidate(categoryKeys.all);
  return useMutation({
    mutationFn: categoriesApi.reorder,
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: categoryKeys.list() });
      const before = qc.getQueryData<ListOf<StoreCategory>>(categoryKeys.list());
      qc.setQueryData<ListOf<StoreCategory>>(categoryKeys.list(), (old) =>
        old ? { data: reordered(old.data, ids) } : old,
      );
      return { before };
    },
    onError: (_e, _v, ctx) => qc.setQueryData(categoryKeys.list(), ctx?.before),
    onSettled: invalidate,
  });
}

/** Cria (corpo completo) ou edita (só os campos que mudaram). */
export function useSaveBlock() {
  const invalidate = useInvalidate(blockKeys.all);
  return useMutation({
    mutationFn: (input: SaveInput<CreateBlockBody, UpdateBlockBody>) =>
      "id" in input ? blocksApi.update(input.id, input.body) : blocksApi.create(input.body),
    onSuccess: invalidate,
  });
}

export function useDeleteBlock() {
  const invalidate = useInvalidate(blockKeys.all);
  return useMutation({
    mutationFn: ({ id, moveTo }: { id: string; moveTo?: string }) => blocksApi.remove(id, moveTo),
    onSuccess: invalidate,
  });
}

/** Nova ordem dos blocos (arrastar), otimista como a das categorias. */
export function useReorderBlocks() {
  const qc = useQueryClient();
  const invalidate = useInvalidate(blockKeys.all);
  return useMutation({
    mutationFn: blocksApi.reorder,
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: blockKeys.list() });
      const before = qc.getQueryData<ListOf<Block>>(blockKeys.list());
      qc.setQueryData<ListOf<Block>>(blockKeys.list(), (old) =>
        old ? { data: reordered(old.data, ids) } : old,
      );
      return { before };
    },
    onError: (_e, _v, ctx) => qc.setQueryData(blockKeys.list(), ctx?.before),
    onSettled: invalidate,
  });
}

/** Põe os itens de `ids` nessas posições (sortOrder = índice); os outros ficam como estão. */
function reordered<T extends { id: string; sortOrder: number }>(items: T[], ids: string[]): T[] {
  const pos = new Map(ids.map((id, i) => [id, i]));
  return items.map((it) => (pos.has(it.id) ? { ...it, sortOrder: pos.get(it.id) ?? 0 } : it));
}

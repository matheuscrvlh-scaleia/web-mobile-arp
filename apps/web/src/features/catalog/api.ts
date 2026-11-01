import {
  blockListSchema,
  blockSchema,
  type CreateBlockBody,
  type CreateStoreCategoryBody,
  ROUTES,
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
  remove: (id: string) => apiCall(ROUTES.storeCategories.remove, { params: { id } }),
};

export const blocksApi = {
  list: (signal?: AbortSignal) => apiRequest(ROUTES.blocks.list, blockListSchema, { signal }),
  create: (body: CreateBlockBody) => apiRequest(ROUTES.blocks.create, blockSchema, { body }),
  update: (id: string, body: UpdateBlockBody) =>
    apiRequest(ROUTES.blocks.update, blockSchema, { params: { id }, body }),
  remove: (id: string) => apiCall(ROUTES.blocks.remove, { params: { id } }),
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
  return useMutation({ mutationFn: categoriesApi.remove, onSuccess: invalidate });
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
  return useMutation({ mutationFn: blocksApi.remove, onSuccess: invalidate });
}

import {
  type CreateSealBody,
  earnedSealPageSchema,
  type ListEarnedSealsQuery,
  type ListOf,
  ROUTES,
  type Seal,
  sealListSchema,
  sealSchema,
  type UpdateSealBody,
} from "@arp/contracts";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiCall, apiRequest, snapshotQueries, updateListItem } from "@/shared/api";
import type { SaveInput } from "@/shared/lib/forms";

export const sealsApi = {
  list: (signal?: AbortSignal) => apiRequest(ROUTES.seals.list, sealListSchema, { signal }),
  create: (body: CreateSealBody) => apiRequest(ROUTES.seals.create, sealSchema, { body }),
  update: (id: string, body: UpdateSealBody) =>
    apiRequest(ROUTES.seals.update, sealSchema, { params: { id }, body }),
  remove: (id: string) => apiCall(ROUTES.seals.remove, { params: { id } }),
  earned: (query: Partial<ListEarnedSealsQuery>, signal?: AbortSignal) =>
    apiRequest(ROUTES.earnedSeals.list, earnedSealPageSchema, { query, signal }),
};

export const sealKeys = {
  all: ["seals"] as const,
  list: () => [...sealKeys.all, "list"] as const,
  earned: (query: Partial<ListEarnedSealsQuery>) => [...sealKeys.all, "earned", query] as const,
};

/** Todos os selos (ativos e arquivados), na ordem de exibição. */
export function useSeals({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: sealKeys.list(),
    queryFn: ({ signal }) => sealsApi.list(signal),
    select: (r) => r.data,
    staleTime: 60_000,
    enabled,
  });
}

/**
 * Cria ou edita (inclui arquivar: status "archived"). Editar é otimista na
 * galeria; o DTO devolvido fica no cache. Selo aparece nos desafios e no
 * histórico dos visitantes: esses recarregam.
 */
export function useSaveSeal() {
  const qc = useQueryClient();
  const key = sealKeys.list();
  return useMutation({
    mutationFn: (input: SaveInput<CreateSealBody, UpdateSealBody>) =>
      "id" in input ? sealsApi.update(input.id, input.body) : sealsApi.create(input.body),
    onMutate: async (input) => {
      if (!("id" in input)) return undefined;
      await qc.cancelQueries({ queryKey: key });
      const rollback = snapshotQueries(qc, key);
      updateListItem<Seal>(qc, key, input.id, (s) => ({ ...s, ...withoutUndefined(input.body) }));
      return { rollback };
    },
    onError: (_e, _v, ctx) => ctx?.rollback(),
    onSuccess: (seal) => {
      qc.setQueryData<ListOf<Seal>>(key, (old) => {
        if (!old) return old;
        const exists = old.data.some((s) => s.id === seal.id);
        return {
          data: exists ? old.data.map((s) => (s.id === seal.id ? seal : s)) : [...old.data, seal],
        };
      });
      return Promise.all([
        qc.invalidateQueries({ queryKey: ["challenges"] }),
        qc.invalidateQueries({ queryKey: ["visitors"] }),
      ]);
    },
  });
}

/** Exclui selo nunca usado (sem conquistas e sem desafio; a API devolve CONFLICT). */
export function useDeleteSeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: sealsApi.remove,
    onSuccess: (_v, id) =>
      qc.setQueryData<ListOf<Seal>>(sealKeys.list(), (old) =>
        old ? { data: old.data.filter((s) => s.id !== id) } : old,
      ),
  });
}

/** O PATCH não tem `undefined` de propósito, mas o tipo permite: não apaga campo no cache. */
function withoutUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}

/** Selos conquistados (paginado, com filtros por campanha, desafio e visitante). */
export function useEarnedSeals(query: Partial<ListEarnedSealsQuery>, { enabled = true } = {}) {
  return useQuery({
    queryKey: sealKeys.earned(query),
    queryFn: ({ signal }) => sealsApi.earned(query, signal),
    placeholderData: keepPreviousData,
    enabled,
  });
}

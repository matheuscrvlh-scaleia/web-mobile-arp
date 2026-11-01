import type { QueryClient, QueryKey } from "@tanstack/react-query";

type WithId = { id: string };
/** Forma comum de `listOf` e `paginated` do contrato: `{ data: T[] }` (+ meta). */
type ListLike<T> = { data: T[] };

const isListLike = <T>(v: unknown): v is ListLike<T> =>
  typeof v === "object" && v !== null && Array.isArray((v as { data?: unknown }).data);

/**
 * Troca um item em todas as listas em cache sob `queryKey` (paginadas ou
 * não), sem refetch: usado com o DTO que a escrita devolve e nas edições
 * otimistas. Listas que não têm o item ficam como estão.
 */
export function updateListItem<T extends WithId>(
  qc: QueryClient,
  queryKey: QueryKey,
  id: string,
  update: (item: T) => T,
): void {
  qc.setQueriesData<unknown>({ queryKey }, (old: unknown) => {
    if (!isListLike<T>(old) || !old.data.some((item) => item.id === id)) return old;
    return { ...old, data: old.data.map((item) => (item.id === id ? update(item) : item)) };
  });
}

/** Foto das queries sob `queryKey`, para desfazer uma edição otimista que falhou. */
export function snapshotQueries(qc: QueryClient, queryKey: QueryKey) {
  const entries = qc.getQueriesData({ queryKey });
  return () => {
    for (const [key, data] of entries) qc.setQueryData(key, data);
  };
}

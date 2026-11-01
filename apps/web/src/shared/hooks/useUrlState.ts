import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";
import type { z } from "zod";

type UrlValue = string | number | boolean | null | undefined;

export interface SetUrlStateOptions {
  /** Volta para a página 1 (padrão: sim, exceto quando o próprio patch muda a página). */
  resetPage?: boolean;
  /** Troca a entrada do histórico em vez de criar outra (ex.: digitação da busca). */
  replace?: boolean;
}

/**
 * Filtros e paginação na URL, validados pelo schema de query do contrato
 * (ex.: listStoresQuerySchema). Valor inválido na URL (link antigo, edição
 * à mão) é descartado em vez de quebrar a tela. Links ficam compartilháveis
 * e o voltar do navegador desfaz o filtro.
 */
export function useUrlState<S extends z.ZodObject>(
  schema: S,
): [z.output<S>, (patch: Record<string, UrlValue>, options?: SetUrlStateOptions) => void] {
  const [params, setParams] = useSearchParams();
  const key = params.toString();

  // biome-ignore lint/correctness/useExhaustiveDependencies: a string da URL é a identidade dos params
  const value = useMemo(() => parseParams(schema, params), [schema, key]);

  const set = useCallback(
    (patch: Record<string, UrlValue>, options: SetUrlStateOptions = {}) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(patch)) {
            if (v === undefined || v === null || v === "") next.delete(k);
            else next.set(k, String(v));
          }
          const resetPage = options.resetPage ?? !("page" in patch);
          if (resetPage) next.delete("page");
          if (next.get("page") === "1") next.delete("page");
          return next;
        },
        { replace: options.replace ?? false },
      );
    },
    [setParams],
  );

  return [value, set];
}

function parseParams<S extends z.ZodObject>(schema: S, params: URLSearchParams): z.output<S> {
  const raw: Record<string, string> = {};
  for (const k of Object.keys(schema.shape)) {
    const v = params.get(k);
    if (v !== null && v !== "") raw[k] = v;
  }
  const first = schema.safeParse(raw);
  if (first.success) return first.data;
  for (const issue of first.error.issues) {
    const k = issue.path[0];
    if (typeof k === "string") delete raw[k];
  }
  const second = schema.safeParse(raw);
  return second.success ? second.data : schema.parse({});
}

/** Um parâmetro simples da URL com opções fechadas (ex.: aba ativa). */
export function useSearchParamOption<T extends string>(
  key: string,
  options: readonly T[],
  fallback: T,
): [T, (value: T) => void] {
  const [params, setParams] = useSearchParams();
  const raw = params.get(key);
  const value =
    raw !== null && (options as readonly string[]).includes(raw) ? (raw as T) : fallback;
  const set = useCallback(
    (v: T) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (v === fallback) next.delete(key);
          else next.set(key, v);
          return next;
        },
        { replace: true },
      );
    },
    [key, fallback, setParams],
  );
  return [value, set];
}

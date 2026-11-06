import {
  COUPON_CODE_PATTERN,
  type CouponClaim,
  couponClaimPageSchema,
  couponClaimSchema,
  type ListClaimsQuery,
  ROUTES,
} from "@arp/contracts";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { couponKeys } from "@/features/coupons";
import { storeKeys } from "@/features/stores";
import { visitorKeys } from "@/features/visitors";
import { apiRequest } from "@/shared/api";

export const claimsApi = {
  list: (query: Partial<ListClaimsQuery>, signal?: AbortSignal) =>
    apiRequest(ROUTES.claims.list, couponClaimPageSchema, { query, signal }),
  lookup: (code: string, signal?: AbortSignal) =>
    apiRequest(ROUTES.claims.lookup, couponClaimSchema, { query: { code }, signal }),
  /** Usa o código no caixa; devolve o cupom pego atualizado (status "redeemed"). */
  redeem: (code: string) => apiRequest(ROUTES.claims.redeem, couponClaimSchema, { body: { code } }),
};

/** Limite do "Exportar CSV" (páginas de 100 por cursor). */
export const CLAIMS_EXPORT_MAX = 10_000;

/**
 * Todos os cupons pegos com os filtros da tela (sem a página), para exportar.
 * Vai pelo cursor, 100 por vez, até acabar ou bater o limite.
 */
export async function fetchAllClaims(
  query: Partial<ListClaimsQuery>,
): Promise<{ rows: CouponClaim[]; truncated: boolean }> {
  const { page: _page, cursor: _cursor, ...filters } = query;
  const rows: CouponClaim[] = [];
  let cursor: string | undefined;
  do {
    const res = await claimsApi.list({ ...filters, pageSize: 100, ...(cursor ? { cursor } : {}) });
    rows.push(...res.data);
    cursor = res.meta.nextCursor ?? undefined;
  } while (cursor && rows.length < CLAIMS_EXPORT_MAX);
  return { rows: rows.slice(0, CLAIMS_EXPORT_MAX), truncated: Boolean(cursor) };
}

export const claimKeys = {
  all: ["claims"] as const,
  lists: () => [...claimKeys.all, "list"] as const,
  list: (query: Partial<ListClaimsQuery>) => [...claimKeys.lists(), query] as const,
  lookup: (code: string) => [...claimKeys.all, "lookup", code] as const,
};

/** Cupons pegos, paginados e filtrados. */
export function useClaims(query: Partial<ListClaimsQuery>, { enabled = true } = {}) {
  return useQuery({
    queryKey: claimKeys.list(query),
    queryFn: ({ signal }) => claimsApi.list(query, signal),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/**
 * Consulta o código no caixa. Só roda com um código completo; sem cache
 * (a situação do cupom muda a qualquer momento) e sem repetir em erro (404
 * e afins são respostas, não falhas passageiras). Trocar o código cancela
 * a consulta anterior (signal).
 */
export function useClaimLookup(code: string | null) {
  const valid = code !== null && COUPON_CODE_PATTERN.test(code);
  return useQuery({
    queryKey: claimKeys.lookup(code ?? ""),
    queryFn: ({ signal }) => claimsApi.lookup(code ?? "", signal),
    enabled: valid,
    retry: false,
    staleTime: 0,
    gcTime: 60_000,
  });
}

/**
 * Valida (usa) o código. A resposta é o cupom pego atualizado; ela já vira
 * o resultado da consulta do mesmo código. Validar muda estoque, painel do
 * lojista, dashboard e o visitante: esses recarregam.
 */
export function useRedeemClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: claimsApi.redeem,
    onSuccess: (claim) => {
      qc.setQueryData(claimKeys.lookup(claim.code), claim);
      return Promise.all([
        qc.invalidateQueries({ queryKey: claimKeys.lists() }),
        qc.invalidateQueries({ queryKey: couponKeys.all }),
        qc.invalidateQueries({ queryKey: storeKeys.all }),
        qc.invalidateQueries({ queryKey: visitorKeys.all }),
        qc.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
    },
  });
}

import {
  activeMerchantInviteListSchema,
  type CouponsByStoreQuery,
  type CreateMerchantInviteBody,
  couponsByStoreSchema,
  type ListMerchantInvitesQuery,
  type ListMerchantSignupsQuery,
  type MerchantSignupBody,
  merchantInvitationSchema,
  merchantInviteSchema,
  merchantSignupListSchema,
  merchantSignupSchema,
  ROUTES,
  userPageSchema,
  userSchema,
} from "@arp/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiCall, apiRequest } from "@/shared/api";

// Lojistas (Fase 2): link de cadastro, aprovação e relatório de cupons por loja.

const S = ROUTES.merchantSignups;

export const merchantsApi = {
  invite: (body: CreateMerchantInviteBody) => apiRequest(S.invite, merchantInviteSchema, { body }),
  invitation: (token: string, signal?: AbortSignal) =>
    apiRequest(S.invitation, merchantInvitationSchema, { params: { token }, signal }),
  signup: (token: string, body: MerchantSignupBody) =>
    apiCall(S.signup, { params: { token }, body }),
  list: (query: ListMerchantSignupsQuery, signal?: AbortSignal) =>
    apiRequest(S.list, merchantSignupListSchema, { query, signal }),
  invites: (query: ListMerchantInvitesQuery, signal?: AbortSignal) =>
    apiRequest(S.invites, activeMerchantInviteListSchema, { query, signal }),
  cancelInvite: (id: string) => apiCall(S.cancelInvite, { params: { id } }),
  approve: (id: string) => apiRequest(S.approve, merchantSignupSchema, { params: { id } }),
  reject: (id: string) => apiRequest(S.reject, merchantSignupSchema, { params: { id } }),
  couponsByStore: (query: CouponsByStoreQuery, signal?: AbortSignal) =>
    apiRequest(ROUTES.clubReports.coupons, couponsByStoreSchema, { query, signal }),
};

export const merchantKeys = {
  signups: (query: ListMerchantSignupsQuery) => ["merchant-signups", query] as const,
  all: ["merchant-signups"] as const,
  invites: (query: ListMerchantInvitesQuery) => ["merchant-invites", query] as const,
  allInvites: ["merchant-invites"] as const,
};

export function useMerchantSignups(query: ListMerchantSignupsQuery, { enabled = true } = {}) {
  return useQuery({
    queryKey: merchantKeys.signups(query),
    queryFn: ({ signal }) => merchantsApi.list(query, signal),
    select: (r) => r.data,
    enabled,
  });
}

export function useDecideSignup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      approve ? merchantsApi.approve(id) : merchantsApi.reject(id),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: merchantKeys.all }),
        qc.invalidateQueries({ queryKey: merchantKeys.allInvites }),
        qc.invalidateQueries({ queryKey: ["users"] }),
      ]),
  });
}

export function useCreateInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: merchantsApi.invite,
    onSuccess: () => qc.invalidateQueries({ queryKey: merchantKeys.allInvites }),
  });
}

/** Links de cadastro ainda valendo (todos ou de uma loja). */
export function useMerchantInvites(query: ListMerchantInvitesQuery, { enabled = true } = {}) {
  return useQuery({
    queryKey: merchantKeys.invites(query),
    queryFn: ({ signal }) => merchantsApi.invites(query, signal),
    select: (r) => r.data,
    enabled,
  });
}

export function useCancelInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: merchantsApi.cancelInvite,
    onSuccess: () => qc.invalidateQueries({ queryKey: merchantKeys.allInvites }),
  });
}

export function useInvitation(token: string) {
  return useQuery({
    queryKey: ["merchant-invitation", token],
    queryFn: ({ signal }) => merchantsApi.invitation(token, signal),
    retry: false,
  });
}

export function useMerchantSignup(token: string) {
  return useMutation({
    mutationFn: (body: MerchantSignupBody) => merchantsApi.signup(token, body),
  });
}

export function useCouponsByStore(query: CouponsByStoreQuery) {
  return useQuery({
    queryKey: ["reports", "coupons-by-store", query],
    queryFn: ({ signal }) => merchantsApi.couponsByStore(query, signal),
    select: (r) => r.data,
  });
}

/* Equipe da loja (usuários com a loja) ------------------------------------ */

const teamKey = (storeId: string) => ["users", "list", { storeId, team: true }] as const;

/** Quem acessa o painel por esta loja (lojistas), ativos e desativados. */
export function useStoreTeam(storeId: string, { enabled = true } = {}) {
  return useQuery({
    queryKey: teamKey(storeId),
    queryFn: ({ signal }) =>
      apiRequest(ROUTES.users.list, userPageSchema, {
        query: { storeId, pageSize: 50 },
        signal,
      }),
    select: (r) => r.data,
    enabled,
  });
}

/**
 * Remover acesso (desativar o usuário) ou devolver. Mesma API de Usuários:
 * a sessão aberta cai na hora e o login fica bloqueado.
 */
export function useSetMerchantAccess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, active }: { userId: string; active: boolean }) =>
      apiRequest(ROUTES.users.update, userSchema, {
        params: { id: userId },
        body: { status: active ? "active" : "disabled" },
      }),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ["users"] }),
        qc.invalidateQueries({ queryKey: merchantKeys.all }),
      ]),
  });
}

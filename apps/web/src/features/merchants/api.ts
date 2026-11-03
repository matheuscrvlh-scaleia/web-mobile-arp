import {
  type CouponsByStoreQuery,
  couponsByStoreSchema,
  type ListMerchantSignupsQuery,
  type MerchantSignupBody,
  merchantInvitationSchema,
  merchantInviteSchema,
  merchantSignupListSchema,
  merchantSignupSchema,
  ROUTES,
} from "@arp/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiCall, apiRequest } from "@/shared/api";

// Lojistas (Fase 2): link de cadastro, aprovação e relatório de cupons por loja.

const S = ROUTES.merchantSignups;

export const merchantsApi = {
  invite: (storeId: string) => apiRequest(S.invite, merchantInviteSchema, { body: { storeId } }),
  invitation: (token: string, signal?: AbortSignal) =>
    apiRequest(S.invitation, merchantInvitationSchema, { params: { token }, signal }),
  signup: (token: string, body: MerchantSignupBody) =>
    apiCall(S.signup, { params: { token }, body }),
  list: (query: ListMerchantSignupsQuery, signal?: AbortSignal) =>
    apiRequest(S.list, merchantSignupListSchema, { query, signal }),
  approve: (id: string) => apiRequest(S.approve, merchantSignupSchema, { params: { id } }),
  reject: (id: string) => apiRequest(S.reject, merchantSignupSchema, { params: { id } }),
  couponsByStore: (query: CouponsByStoreQuery, signal?: AbortSignal) =>
    apiRequest(ROUTES.clubReports.coupons, couponsByStoreSchema, { query, signal }),
};

const keys = {
  signups: (query: ListMerchantSignupsQuery) => ["merchant-signups", query] as const,
  all: ["merchant-signups"] as const,
};

export function useMerchantSignups(query: ListMerchantSignupsQuery) {
  return useQuery({
    queryKey: keys.signups(query),
    queryFn: ({ signal }) => merchantsApi.list(query, signal),
    select: (r) => r.data,
  });
}

export function useDecideSignup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      approve ? merchantsApi.approve(id) : merchantsApi.reject(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}

export function useCreateInvite() {
  return useMutation({ mutationFn: merchantsApi.invite });
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

import {
  type Coupon,
  type CouponStatus,
  type CreateCouponBody,
  couponPageSchema,
  couponSchema,
  type ListCouponsQuery,
  type ReviewCouponBody,
  ROUTES,
  type UpdateCouponBody,
} from "@arp/contracts";
import {
  keepPreviousData,
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useAppSettings } from "@/features/settings";
import { storeKeys } from "@/features/stores";
import { apiRequest, snapshotQueries, updateListItem } from "@/shared/api";
import { useAuth } from "@/shared/auth";

export const couponsApi = {
  list: (query: Partial<ListCouponsQuery>, signal?: AbortSignal) =>
    apiRequest(ROUTES.coupons.list, couponPageSchema, { query, signal }),
  get: (id: string, signal?: AbortSignal) =>
    apiRequest(ROUTES.coupons.get, couponSchema, { params: { id }, signal }),
  create: (body: CreateCouponBody) => apiRequest(ROUTES.coupons.create, couponSchema, { body }),
  update: (id: string, body: UpdateCouponBody) =>
    apiRequest(ROUTES.coupons.update, couponSchema, { params: { id }, body }),
  changeStatus: (id: string, status: CouponStatus) =>
    apiRequest(ROUTES.coupons.changeStatus, couponSchema, { params: { id }, body: { status } }),
  review: (id: string, body: ReviewCouponBody) =>
    apiRequest(ROUTES.coupons.review, couponSchema, { params: { id }, body }),
};

export const couponKeys = {
  all: ["coupons"] as const,
  lists: () => [...couponKeys.all, "list"] as const,
  list: (query: Partial<ListCouponsQuery>) => [...couponKeys.lists(), query] as const,
  details: () => [...couponKeys.all, "detail"] as const,
  detail: (id: string) => [...couponKeys.details(), id] as const,
};

/** Promoções paginadas com filtros (a página anterior fica na tela enquanto a nova chega). */
export function useCoupons(query: Partial<ListCouponsQuery>, { enabled = true } = {}) {
  return useQuery({
    queryKey: couponKeys.list(query),
    queryFn: ({ signal }) => couponsApi.list(query, signal),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useCoupon(id: string | undefined) {
  return useQuery({
    queryKey: couponKeys.detail(id ?? ""),
    queryFn: ({ signal }) => couponsApi.get(id ?? "", signal),
    enabled: Boolean(id),
  });
}

/**
 * Promoção salva: o DTO devolvido vira o detalhe e o item das listas na
 * hora. Ela mexe no selo "tem cupom" das lojas e no dashboard, e as listas
 * podem mudar de ordem/filtro: esses recarregam.
 */
function couponSaved(qc: QueryClient, coupon: Coupon) {
  qc.setQueryData(couponKeys.detail(coupon.id), coupon);
  updateListItem<Coupon>(qc, couponKeys.lists(), coupon.id, () => coupon);
  return Promise.all([
    qc.invalidateQueries({ queryKey: couponKeys.lists() }),
    qc.invalidateQueries({ queryKey: storeKeys.all }),
    qc.invalidateQueries({ queryKey: ["dashboard"] }),
  ]);
}

export function useCreateCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: couponsApi.create,
    onSuccess: (coupon) => couponSaved(qc, coupon),
  });
}

/** PATCH só com os campos que mudaram. */
export function useUpdateCoupon(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateCouponBody) => couponsApi.update(id, body),
    onSuccess: (coupon) => couponSaved(qc, coupon),
  });
}

/** Ativar, pausar ou encerrar. Otimista no detalhe e nas listas em cache. */
/** Aprovar ou recusar o cupom do lojista (coupons.approve). */
export function useReviewCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & ReviewCouponBody) => couponsApi.review(id, body),
    onSuccess: (coupon) => couponSaved(qc, coupon),
  });
}

export function useChangeCouponStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: CouponStatus }) =>
      couponsApi.changeStatus(id, status),
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: couponKeys.all });
      const rollback = snapshotQueries(qc, couponKeys.all);
      qc.setQueryData<Coupon>(couponKeys.detail(id), (old) => (old ? { ...old, status } : old));
      updateListItem<Coupon>(qc, couponKeys.lists(), id, (c) => ({ ...c, status }));
      return { rollback };
    },
    onError: (_e, _v, ctx) => ctx?.rollback(),
    onSuccess: (coupon) => couponSaved(qc, coupon),
  });
}

export const FALLBACK_WINDOW_HOURS = 24;

/**
 * Prazo padrão para usar o cupom: vem das configurações do app quando a
 * pessoa pode lê-las (settings.manage); senão, 24 h.
 */
export function useDefaultRedeemWindow(): { hours: number; loading: boolean } {
  const { can } = useAuth();
  const allowed = can("settings.manage");
  const settings = useAppSettings({ enabled: allowed });
  return {
    hours: settings.data?.couponDefaultWindowHours ?? FALLBACK_WINDOW_HOURS,
    loading: allowed && settings.isLoading,
  };
}

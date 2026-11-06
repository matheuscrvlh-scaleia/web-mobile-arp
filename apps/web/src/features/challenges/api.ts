import {
  type Challenge,
  type CreateChallengeBody,
  type CreateQrCodeBody,
  challengeListSchema,
  challengeSchema,
  type ListOf,
  type QrCode,
  qrCodeListSchema,
  qrCodeSchema,
  ROUTES,
  type UpdateChallengeBody,
  type UpdateQrCodeBody,
} from "@arp/contracts";
import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiCall, apiRequest, snapshotQueries, updateListItem } from "@/shared/api";

export const challengesApi = {
  listByCoupon: (couponId: string, signal?: AbortSignal) =>
    apiRequest(ROUTES.challenges.list, challengeListSchema, { query: { couponId }, signal }),
  list: (campaignId: string | undefined, signal?: AbortSignal) =>
    apiRequest(ROUTES.challenges.list, challengeListSchema, { query: { campaignId }, signal }),
  get: (id: string, signal?: AbortSignal) =>
    apiRequest(ROUTES.challenges.get, challengeSchema, { params: { id }, signal }),
  create: (body: CreateChallengeBody) =>
    apiRequest(ROUTES.challenges.create, challengeSchema, { body }),
  update: (id: string, body: UpdateChallengeBody) =>
    apiRequest(ROUTES.challenges.update, challengeSchema, { params: { id }, body }),
  remove: (id: string) => apiCall(ROUTES.challenges.remove, { params: { id } }),
  reorder: (campaignId: string, ids: string[]) =>
    apiCall(ROUTES.campaigns.reorderChallenges, { params: { id: campaignId }, body: { ids } }),
};

export const qrCodesApi = {
  list: (challengeId: string, signal?: AbortSignal) =>
    apiRequest(ROUTES.qrCodes.list, qrCodeListSchema, { params: { id: challengeId }, signal }),
  create: (challengeId: string, body: CreateQrCodeBody) =>
    apiRequest(ROUTES.qrCodes.create, qrCodeSchema, { params: { id: challengeId }, body }),
  update: (id: string, body: UpdateQrCodeBody) =>
    apiRequest(ROUTES.qrCodes.update, qrCodeSchema, { params: { id }, body }),
};

export const challengeKeys = {
  all: ["challenges"] as const,
  lists: () => [...challengeKeys.all, "list"] as const,
  list: (campaignId: string | undefined) => [...challengeKeys.lists(), campaignId ?? null] as const,
  byCoupon: (couponId: string) => [...challengeKeys.lists(), "coupon", couponId] as const,
  detail: (id: string) => [...challengeKeys.all, "detail", id] as const,
  qrCodes: (challengeId: string) => [...challengeKeys.all, "qr-codes", challengeId] as const,
};

/** Desafios (de uma campanha, ou todos). */
export function useChallenges(campaignId: string | undefined, { enabled = true } = {}) {
  return useQuery({
    queryKey: challengeKeys.list(campaignId),
    queryFn: ({ signal }) => challengesApi.list(campaignId, signal),
    select: (r) => r.data,
    enabled,
  });
}

/** Desafios automáticos que dão selo na baixa deste cupom. */
export function useCouponChallenges(couponId: string, { enabled = true } = {}) {
  return useQuery({
    queryKey: challengeKeys.byCoupon(couponId),
    queryFn: ({ signal }) => challengesApi.listByCoupon(couponId, signal),
    select: (r) => r.data,
    enabled,
  });
}

export function useChallenge(id: string | undefined) {
  return useQuery({
    queryKey: challengeKeys.detail(id ?? ""),
    queryFn: ({ signal }) => challengesApi.get(id ?? "", signal),
    enabled: Boolean(id),
  });
}

/**
 * Desafio salvo: o DTO vira o detalhe na hora. Ele conta na campanha
 * (challengesCount) e aparece no evento ligado: as listas recarregam.
 */
function challengeSaved(qc: QueryClient, challenge: Challenge) {
  qc.setQueryData(challengeKeys.detail(challenge.id), challenge);
  updateListItem<Challenge>(qc, challengeKeys.lists(), challenge.id, () => challenge);
  return invalidateRelated(qc);
}

const invalidateRelated = (qc: QueryClient) =>
  Promise.all([
    qc.invalidateQueries({ queryKey: challengeKeys.lists() }),
    qc.invalidateQueries({ queryKey: ["campaigns"] }),
    qc.invalidateQueries({ queryKey: ["events"] }),
  ]);

export function useCreateChallenge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: challengesApi.create,
    onSuccess: (challenge) => challengeSaved(qc, challenge),
  });
}

/** PATCH só com os campos que mudaram. */
export function useUpdateChallenge(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateChallengeBody) => challengesApi.update(id, body),
    onSuccess: (challenge) => challengeSaved(qc, challenge),
  });
}

/** Só dá para excluir desafio que ainda não deu selo (a API devolve CONFLICT). */
export function useDeleteChallenge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: challengesApi.remove,
    onSuccess: (_v, id) => {
      qc.removeQueries({ queryKey: challengeKeys.detail(id) });
      return invalidateRelated(qc);
    },
  });
}

/**
 * Pausar/retomar na hora (lista e cabeçalho): otimista, volta se der erro.
 * Quem chama mostra o toast com "Desfazer" (que chama de novo com o oposto).
 */
export function useSetChallengeStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: Challenge["status"] }) =>
      challengesApi.update(id, { status }),
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: challengeKeys.all });
      const rollback = snapshotQueries(qc, challengeKeys.all);
      updateListItem<Challenge>(qc, challengeKeys.lists(), id, (c) => ({ ...c, status }));
      qc.setQueryData<Challenge>(challengeKeys.detail(id), (c) => (c ? { ...c, status } : c));
      return { rollback };
    },
    onError: (_e, _v, ctx) => ctx?.rollback(),
    onSuccess: (challenge) => challengeSaved(qc, challenge),
  });
}

/** Nova ordem dos desafios da campanha (arrastar): otimista, volta se der erro. */
export function useReorderChallenges(campaignId: string) {
  const qc = useQueryClient();
  const key = challengeKeys.list(campaignId);
  return useMutation({
    mutationFn: (ids: string[]) => challengesApi.reorder(campaignId, ids),
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: key });
      const rollback = snapshotQueries(qc, key);
      const position = new Map(ids.map((id, i) => [id, i]));
      qc.setQueryData<ListOf<Challenge>>(key, (old) =>
        old
          ? {
              data: old.data.map((c) => ({ ...c, sortOrder: position.get(c.id) ?? c.sortOrder })),
            }
          : old,
      );
      return { rollback };
    },
    onError: (_e, _v, ctx) => ctx?.rollback(),
    onSettled: () => qc.invalidateQueries({ queryKey: challengeKeys.lists() }),
  });
}

/* QR Codes do desafio ----------------------------------------------------- */

export function useQrCodes(challengeId: string | undefined) {
  return useQuery({
    queryKey: challengeKeys.qrCodes(challengeId ?? ""),
    queryFn: ({ signal }) => qrCodesApi.list(challengeId ?? "", signal),
    select: (r) => r.data,
    enabled: Boolean(challengeId),
  });
}

/**
 * QR salvo entra na lista do desafio na hora (DTO da API); o desafio
 * (qrCodesCount) recarrega.
 */
function qrCodeSaved(qc: QueryClient, qr: QrCode) {
  qc.setQueryData<ListOf<QrCode>>(challengeKeys.qrCodes(qr.challengeId), (old) => {
    if (!old) return old;
    const exists = old.data.some((q) => q.id === qr.id);
    return { data: exists ? old.data.map((q) => (q.id === qr.id ? qr : q)) : [...old.data, qr] };
  });
  return Promise.all([
    qc.invalidateQueries({ queryKey: challengeKeys.detail(qr.challengeId) }),
    qc.invalidateQueries({ queryKey: challengeKeys.lists() }),
  ]);
}

/** Gera um QR Code novo; devolve o QR criado (com o payload) para já imprimir. */
export function useCreateQrCode(challengeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateQrCodeBody) => qrCodesApi.create(challengeId, body),
    onSuccess: (qr) => qrCodeSaved(qc, qr),
  });
}

/** Edita rótulo/janela de validade ou revoga (status "revoked"). */
export function useUpdateQrCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateQrCodeBody }) =>
      qrCodesApi.update(id, body),
    onSuccess: (qr) => qrCodeSaved(qc, qr),
  });
}

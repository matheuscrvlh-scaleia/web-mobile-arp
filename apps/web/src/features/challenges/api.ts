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
import { apiCall, apiRequest, updateListItem } from "@/shared/api";

export const challengesApi = {
  list: (campaignId: string | undefined, signal?: AbortSignal) =>
    apiRequest(ROUTES.challenges.list, challengeListSchema, { query: { campaignId }, signal }),
  get: (id: string, signal?: AbortSignal) =>
    apiRequest(ROUTES.challenges.get, challengeSchema, { params: { id }, signal }),
  create: (body: CreateChallengeBody) =>
    apiRequest(ROUTES.challenges.create, challengeSchema, { body }),
  update: (id: string, body: UpdateChallengeBody) =>
    apiRequest(ROUTES.challenges.update, challengeSchema, { params: { id }, body }),
  remove: (id: string) => apiCall(ROUTES.challenges.remove, { params: { id } }),
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

/** Só dá para apagar desafio que ainda não deu selo (a API devolve CONFLICT). */
export function useDeleteChallenge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: challengesApi.remove,
    onSuccess: () => invalidateRelated(qc),
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

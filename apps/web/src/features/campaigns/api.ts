import {
  type Campaign,
  type CreateCampaignBody,
  campaignListSchema,
  campaignSchema,
  type DuplicateCampaignBody,
  type ReplaceTiersBody,
  ROUTES,
  type UpdateCampaignBody,
} from "@arp/contracts";
import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiCall, apiRequest, updateListItem } from "@/shared/api";

export const campaignsApi = {
  list: (signal?: AbortSignal) => apiRequest(ROUTES.campaigns.list, campaignListSchema, { signal }),
  get: (id: string, signal?: AbortSignal) =>
    apiRequest(ROUTES.campaigns.get, campaignSchema, { params: { id }, signal }),
  create: (body: CreateCampaignBody) =>
    apiRequest(ROUTES.campaigns.create, campaignSchema, { body }),
  update: (id: string, body: UpdateCampaignBody) =>
    apiRequest(ROUTES.campaigns.update, campaignSchema, { params: { id }, body }),
  replaceTiers: (id: string, body: ReplaceTiersBody) =>
    apiRequest(ROUTES.campaigns.replaceTiers, campaignSchema, { params: { id }, body }),
  remove: (id: string) => apiCall(ROUTES.campaigns.remove, { params: { id } }),
  duplicate: (id: string, body: DuplicateCampaignBody) =>
    apiRequest(ROUTES.campaigns.duplicate, campaignSchema, { params: { id }, body }),
};

export const campaignKeys = {
  all: ["campaigns"] as const,
  list: () => [...campaignKeys.all, "list"] as const,
  detail: (id: string) => [...campaignKeys.all, "detail", id] as const,
};

/** Todas as campanhas com as faixas (lista curta, sem paginação). */
export function useCampaigns({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: campaignKeys.list(),
    queryFn: ({ signal }) => campaignsApi.list(signal),
    select: (r) => r.data,
    enabled,
  });
}

export function useCampaign(id: string | undefined) {
  return useQuery({
    queryKey: campaignKeys.detail(id ?? ""),
    queryFn: ({ signal }) => campaignsApi.get(id ?? "", signal),
    enabled: Boolean(id),
  });
}

/**
 * Campanha salva: o DTO vira o detalhe e o item da lista na hora. O nome
 * aparece nos desafios e nos selos conquistados: esses recarregam.
 */
function campaignSaved(qc: QueryClient, campaign: Campaign) {
  qc.setQueryData(campaignKeys.detail(campaign.id), campaign);
  updateListItem<Campaign>(qc, campaignKeys.list(), campaign.id, () => campaign);
  return Promise.all([
    qc.invalidateQueries({ queryKey: campaignKeys.list() }),
    qc.invalidateQueries({ queryKey: ["challenges"] }),
    qc.invalidateQueries({ queryKey: ["seals"] }),
  ]);
}

export function useCreateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: campaignsApi.create,
    onSuccess: (campaign) => campaignSaved(qc, campaign),
  });
}

/** PATCH só com os campos que mudaram (inclui publicar/arquivar). */
export function useUpdateCampaign(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateCampaignBody) => campaignsApi.update(id, body),
    onSuccess: (campaign) => campaignSaved(qc, campaign),
  });
}

/** Substitui todas as faixas de benefício da campanha de uma vez. */
export function useReplaceTiers(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ReplaceTiersBody) => campaignsApi.replaceTiers(id, body),
    onSuccess: (campaign) => {
      qc.setQueryData(campaignKeys.detail(campaign.id), campaign);
      updateListItem<Campaign>(qc, campaignKeys.list(), campaign.id, () => campaign);
    },
  });
}

/** Exclui campanha sem selos dados (desafios e QR Codes vão junto; a API devolve CONFLICT). */
export function useDeleteCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: campaignsApi.remove,
    onSuccess: (_v, id) => {
      qc.removeQueries({ queryKey: campaignKeys.detail(id) });
      return Promise.all([
        qc.invalidateQueries({ queryKey: campaignKeys.list() }),
        qc.invalidateQueries({ queryKey: ["challenges"] }),
        qc.invalidateQueries({ queryKey: ["seals"] }),
      ]);
    },
  });
}

/** Duplica a campanha (faixas e desafios, sem QR) como rascunho. */
export function useDuplicateCampaign(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: DuplicateCampaignBody) => campaignsApi.duplicate(id, body),
    onSuccess: (campaign) => campaignSaved(qc, campaign),
  });
}

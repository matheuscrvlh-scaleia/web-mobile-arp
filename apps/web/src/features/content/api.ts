import {
  artPointListSchema,
  artPointSchema,
  type ContentPageKey,
  type CreateArtPointBody,
  type CreateJobBody,
  type CreateRecyclingItemBody,
  contentPageListSchema,
  contentPageSchema,
  jobListSchema,
  jobSchema,
  type ListJobsQuery,
  type RecyclingItem,
  ROUTES,
  recyclingItemListSchema,
  recyclingItemSchema,
  type UpdateArtPointBody,
  type UpdateContentPageBody,
  type UpdateJobBody,
  type UpdateRecyclingItemBody,
} from "@arp/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiCall, apiRequest } from "@/shared/api";
import type { SaveInput } from "@/shared/lib/forms";

// Conteúdo da ARP (Fase 2): textos, Circuito Cultural, Sustentarp e vagas.
// Listas pequenas e completas (sem paginação).

export const contentApi = {
  pages: (signal?: AbortSignal) =>
    apiRequest(ROUTES.contentPages.list, contentPageListSchema, { signal }),
  updatePage: (key: ContentPageKey, body: UpdateContentPageBody) =>
    apiRequest(ROUTES.contentPages.update, contentPageSchema, { params: { key }, body }),
  artPoints: (signal?: AbortSignal) =>
    apiRequest(ROUTES.artPoints.list, artPointListSchema, { signal }),
  createArtPoint: (body: CreateArtPointBody) =>
    apiRequest(ROUTES.artPoints.create, artPointSchema, { body }),
  updateArtPoint: (id: string, body: UpdateArtPointBody) =>
    apiRequest(ROUTES.artPoints.update, artPointSchema, { params: { id }, body }),
  removeArtPoint: (id: string) => apiCall(ROUTES.artPoints.remove, { params: { id } }),
  recyclingItems: (signal?: AbortSignal) =>
    apiRequest(ROUTES.recyclingItems.list, recyclingItemListSchema, { signal }),
  createRecyclingItem: (body: CreateRecyclingItemBody) =>
    apiRequest(ROUTES.recyclingItems.create, recyclingItemSchema, { body }),
  updateRecyclingItem: (id: string, body: UpdateRecyclingItemBody) =>
    apiRequest(ROUTES.recyclingItems.update, recyclingItemSchema, { params: { id }, body }),
  removeRecyclingItem: (id: string) => apiCall(ROUTES.recyclingItems.remove, { params: { id } }),
  /** Nova ordem do Sustentarp (todos os ids). */
  reorderRecyclingItems: (ids: string[]) =>
    apiCall(ROUTES.recyclingItems.reorder, { body: { ids } }),
  jobs: (query: ListJobsQuery, signal?: AbortSignal) =>
    apiRequest(ROUTES.jobs.list, jobListSchema, { query, signal }),
  createJob: (body: CreateJobBody) => apiRequest(ROUTES.jobs.create, jobSchema, { body }),
  updateJob: (id: string, body: UpdateJobBody) =>
    apiRequest(ROUTES.jobs.update, jobSchema, { params: { id }, body }),
  removeJob: (id: string) => apiCall(ROUTES.jobs.remove, { params: { id } }),
  /** Encerrar agora: vai para "Encerradas" (republica com updateJob { days }). */
  closeJob: (id: string) => apiRequest(ROUTES.jobs.close, jobSchema, { params: { id } }),
};

export const contentKeys = {
  pages: ["content", "pages"] as const,
  artPoints: ["content", "art-points"] as const,
  recycling: ["content", "recycling-items"] as const,
  jobs: (query: ListJobsQuery = {}) => ["jobs", query] as const,
  allJobs: ["jobs"] as const,
};

export function useContentPages() {
  return useQuery({
    queryKey: contentKeys.pages,
    queryFn: ({ signal }) => contentApi.pages(signal),
    select: (r) => r.data,
  });
}

export function useArtPoints() {
  return useQuery({
    queryKey: contentKeys.artPoints,
    queryFn: ({ signal }) => contentApi.artPoints(signal),
    select: (r) => r.data,
  });
}

export function useRecyclingItems() {
  return useQuery({
    queryKey: contentKeys.recycling,
    queryFn: ({ signal }) => contentApi.recyclingItems(signal),
    select: (r) => r.data,
  });
}

export function useJobs(query: ListJobsQuery) {
  return useQuery({
    queryKey: contentKeys.jobs(query),
    queryFn: ({ signal }) => contentApi.jobs(query, signal),
    select: (r) => r.data,
  });
}

function useInvalidate(key: readonly unknown[]) {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: key });
}

export function useUpdateContentPage() {
  const invalidate = useInvalidate(contentKeys.pages);
  return useMutation({
    mutationFn: (input: { key: ContentPageKey; body: UpdateContentPageBody }) =>
      contentApi.updatePage(input.key, input.body),
    onSuccess: invalidate,
  });
}

export function useSaveArtPoint() {
  const invalidate = useInvalidate(contentKeys.artPoints);
  return useMutation({
    mutationFn: (input: SaveInput<CreateArtPointBody, UpdateArtPointBody>) =>
      "id" in input
        ? contentApi.updateArtPoint(input.id, input.body)
        : contentApi.createArtPoint(input.body),
    onSuccess: invalidate,
  });
}

export function useDeleteArtPoint() {
  const invalidate = useInvalidate(contentKeys.artPoints);
  return useMutation({ mutationFn: contentApi.removeArtPoint, onSuccess: invalidate });
}

export function useSaveRecyclingItem() {
  const invalidate = useInvalidate(contentKeys.recycling);
  return useMutation({
    mutationFn: (input: SaveInput<CreateRecyclingItemBody, UpdateRecyclingItemBody>) =>
      "id" in input
        ? contentApi.updateRecyclingItem(input.id, input.body)
        : contentApi.createRecyclingItem(input.body),
    onSuccess: invalidate,
  });
}

/** Ordem do Sustentarp por arrastar: a lista já mostra a nova ordem enquanto salva. */
export function useReorderRecyclingItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: contentApi.reorderRecyclingItems,
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: contentKeys.recycling });
      const previous = qc.getQueryData<{ data: RecyclingItem[] }>(contentKeys.recycling);
      if (previous) {
        const byId = new Map(previous.data.map((i) => [i.id, i]));
        const data = ids.flatMap((id, i) => {
          const item = byId.get(id);
          return item ? [{ ...item, sortOrder: i + 1 }] : [];
        });
        qc.setQueryData(contentKeys.recycling, { data });
      }
      return { previous };
    },
    onError: (_e, _ids, ctx) => {
      if (ctx?.previous) qc.setQueryData(contentKeys.recycling, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: contentKeys.recycling }),
  });
}

export function useDeleteRecyclingItem() {
  const invalidate = useInvalidate(contentKeys.recycling);
  return useMutation({ mutationFn: contentApi.removeRecyclingItem, onSuccess: invalidate });
}

export function useSaveJob() {
  const invalidate = useInvalidate(contentKeys.allJobs);
  return useMutation({
    mutationFn: (input: SaveInput<CreateJobBody, UpdateJobBody>) =>
      "id" in input ? contentApi.updateJob(input.id, input.body) : contentApi.createJob(input.body),
    onSuccess: invalidate,
  });
}

export function useRemoveJob() {
  const invalidate = useInvalidate(contentKeys.allJobs);
  return useMutation({ mutationFn: contentApi.removeJob, onSuccess: invalidate });
}

export function useCloseJob() {
  const invalidate = useInvalidate(contentKeys.allJobs);
  return useMutation({ mutationFn: contentApi.closeJob, onSuccess: invalidate });
}

/** Republica (ou encerra de novo para desfazer): renova o prazo a partir de hoje. */
export function useRepublishJob() {
  const invalidate = useInvalidate(contentKeys.allJobs);
  return useMutation({
    mutationFn: ({ id, days }: { id: string; days: number }) => contentApi.updateJob(id, { days }),
    onSuccess: invalidate,
  });
}

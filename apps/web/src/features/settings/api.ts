import { appSettingsSchema, ROUTES, type UpdateAppSettingsBody } from "@arp/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/shared/api";

export const settingsApi = {
  get: (signal?: AbortSignal) => apiRequest(ROUTES.settings.get, appSettingsSchema, { signal }),
  /** PATCH só com o que mudou; devolve as configurações completas. */
  update: (body: UpdateAppSettingsBody) =>
    apiRequest(ROUTES.settings.update, appSettingsSchema, { body }),
};

export const settingsKeys = {
  all: ["settings"] as const,
};

export function useAppSettings({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: settingsKeys.all,
    queryFn: ({ signal }) => settingsApi.get(signal),
    staleTime: 5 * 60_000,
    enabled,
  });
}

/** Salva só o que mudou; a resposta (completa) já fica no cache, sem refetch. */
export function useSaveAppSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: settingsApi.update,
    onSuccess: (settings) => qc.setQueryData(settingsKeys.all, settings),
  });
}

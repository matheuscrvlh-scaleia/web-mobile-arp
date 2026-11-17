import {
  type RdStationConfig,
  ROUTES,
  rdStationConfigSchema,
  type UpdateRdStationBody,
} from "@arp/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiCall, apiRequest } from "@/shared/api";

const rd = ROUTES.integrations.rdStation;

export const rdStationApi = {
  get: (signal?: AbortSignal) => apiRequest(rd.get, rdStationConfigSchema, { signal }),
  update: (body: UpdateRdStationBody) => apiRequest(rd.update, rdStationConfigSchema, { body }),
  connect: (code: string) => apiRequest(rd.connect, rdStationConfigSchema, { body: { code } }),
  test: () => apiRequest(rd.test, rdStationConfigSchema),
  remove: () => apiCall(rd.remove),
};

export const rdStationKeys = { all: ["integrations", "rd-station"] as const };

export function useRdStation() {
  return useQuery({
    queryKey: rdStationKeys.all,
    queryFn: ({ signal }) => rdStationApi.get(signal),
  });
}

/** Toda escrita devolve a configuração completa: vai direto para o cache. */
function useRdMutation<A>(fn: (arg: A) => Promise<RdStationConfig>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (config) => qc.setQueryData(rdStationKeys.all, config),
  });
}

export const useSaveRdStation = () => useRdMutation(rdStationApi.update);
export const useConnectRdStation = () => useRdMutation(rdStationApi.connect);
export const useTestRdStation = () => useRdMutation((_: undefined) => rdStationApi.test());

export function useRemoveRdStation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: rdStationApi.remove,
    onSuccess: () => qc.invalidateQueries({ queryKey: rdStationKeys.all }),
  });
}

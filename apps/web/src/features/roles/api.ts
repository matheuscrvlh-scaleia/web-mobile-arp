import {
  type CreateRoleBody,
  type ListOf,
  ROUTES,
  type Role,
  roleListSchema,
  roleSchema,
  type UpdateRoleBody,
} from "@arp/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiCall, apiRequest } from "@/shared/api";
import type { SaveInput } from "@/shared/lib/forms";

export const rolesApi = {
  list: (signal?: AbortSignal) => apiRequest(ROUTES.roles.list, roleListSchema, { signal }),
  create: (body: CreateRoleBody) => apiRequest(ROUTES.roles.create, roleSchema, { body }),
  update: (id: string, body: UpdateRoleBody) =>
    apiRequest(ROUTES.roles.update, roleSchema, { params: { id }, body }),
  remove: (id: string) => apiCall(ROUTES.roles.remove, { params: { id } }),
};

export const roleKeys = {
  all: ["roles"] as const,
  list: () => [...roleKeys.all, "list"] as const,
};

/** Cargo do sistema primeiro; depois por nome. */
const sortRoles = (r: ListOf<Role>) =>
  [...r.data].sort(
    (a, b) => Number(b.isSystem) - Number(a.isSystem) || a.name.localeCompare(b.name, "pt-BR"),
  );

/** Cargos (lista curta; o detalhe sai daqui, não há GET /roles/:id). */
export function useRoles({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: roleKeys.list(),
    queryFn: ({ signal }) => rolesApi.list(signal),
    select: sortRoles,
    staleTime: 5 * 60_000,
    enabled,
  });
}

/** Cria (corpo completo) ou edita (só os campos que mudaram). */
export function useSaveRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveInput<CreateRoleBody, UpdateRoleBody>) =>
      "id" in input ? rolesApi.update(input.id, input.body) : rolesApi.create(input.body),
    onSuccess: () => qc.invalidateQueries({ queryKey: roleKeys.all }),
  });
}

export function useDeleteRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: rolesApi.remove,
    onSuccess: () => qc.invalidateQueries({ queryKey: roleKeys.all }),
  });
}

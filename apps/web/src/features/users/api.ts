import {
  type CreateUserBody,
  createUserResponseSchema,
  type ListUsersQuery,
  ROUTES,
  resetPasswordResponseSchema,
  type UpdateUserBody,
  type User,
  userPageSchema,
  userSchema,
} from "@arp/contracts";
import {
  keepPreviousData,
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { roleKeys } from "@/features/roles";
import { apiRequest, updateListItem } from "@/shared/api";

export const usersApi = {
  list: (query: Partial<ListUsersQuery>, signal?: AbortSignal) =>
    apiRequest(ROUTES.users.list, userPageSchema, { query, signal }),
  get: (id: string, signal?: AbortSignal) =>
    apiRequest(ROUTES.users.get, userSchema, { params: { id }, signal }),
  /** Sem senha, a API gera uma provisória e devolve uma única vez. */
  create: (body: CreateUserBody) =>
    apiRequest(ROUTES.users.create, createUserResponseSchema, { body }),
  update: (id: string, body: UpdateUserBody) =>
    apiRequest(ROUTES.users.update, userSchema, { params: { id }, body }),
  resetPassword: (id: string) =>
    apiRequest(ROUTES.users.resetPassword, resetPasswordResponseSchema, { params: { id } }),
};

export const userKeys = {
  all: ["users"] as const,
  lists: () => [...userKeys.all, "list"] as const,
  list: (query: Partial<ListUsersQuery>) => [...userKeys.lists(), query] as const,
  detail: (id: string) => [...userKeys.all, "detail", id] as const,
};

export function useUsers(query: Partial<ListUsersQuery>) {
  return useQuery({
    queryKey: userKeys.list(query),
    queryFn: ({ signal }) => usersApi.list(query, signal),
    placeholderData: keepPreviousData,
  });
}

export function useUser(id: string) {
  return useQuery({
    queryKey: userKeys.detail(id),
    queryFn: ({ signal }) => usersApi.get(id, signal),
  });
}

/** Usuário salvo: o DTO vira o detalhe na hora; listas e a contagem por cargo recarregam. */
function userSaved(qc: QueryClient, user: User) {
  qc.setQueryData(userKeys.detail(user.id), user);
  updateListItem<User>(qc, userKeys.lists(), user.id, () => user);
  return Promise.all([
    qc.invalidateQueries({ queryKey: userKeys.lists() }),
    qc.invalidateQueries({ queryKey: roleKeys.all }),
  ]);
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: usersApi.create,
    onSuccess: ({ user }) => userSaved(qc, user),
  });
}

export function useUpdateUser(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateUserBody) => usersApi.update(id, body),
    onSuccess: (user) => userSaved(qc, user),
  });
}

/** Gera uma senha provisória (o usuário troca no próximo acesso). */
export function useResetPassword(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => usersApi.resetPassword(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: userKeys.detail(id) }),
  });
}

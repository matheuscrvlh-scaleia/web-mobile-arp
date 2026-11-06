import {
  authUserSchema,
  type ChangePasswordBody,
  type LoginBody,
  ROUTES,
  sessionResponseSchema,
} from "@arp/contracts";
import { useMutation } from "@tanstack/react-query";
import { apiCall, apiRequest } from "@/shared/api";
import { useAuth } from "@/shared/auth";

export const authApi = {
  login: (body: LoginBody) => apiRequest(ROUTES.auth.login, sessionResponseSchema, { body }),
  me: (signal?: AbortSignal) => apiRequest(ROUTES.auth.me, authUserSchema, { signal }),
  changePassword: (body: ChangePasswordBody) => apiCall(ROUTES.auth.changePassword, { body }),
};

/*
 * Senha provisória que a pessoa acabou de digitar no login (só em memória,
 * nesta aba): a tela de criar a senha não pede de novo. Recarregou, sumiu,
 * e o campo volta.
 */
let provisional: string | null = null;
export const provisionalPassword = () => provisional;
export const forgetProvisionalPassword = () => {
  provisional = null;
};

/** Entrar: guarda a sessão (token em memória, refresh no cookie). */
export function useLogin() {
  const { signIn } = useAuth();
  return useMutation({
    mutationFn: authApi.login,
    onSuccess: (session, body) => {
      provisional = session.user.mustChangePassword ? body.password : null;
      signIn(session);
    },
  });
}

/** Trocar a própria senha e recarregar o usuário (sai o "precisa trocar a senha"). */
export function useChangePassword() {
  const { setUser } = useAuth();
  return useMutation({
    mutationFn: async (body: ChangePasswordBody) => {
      await authApi.changePassword(body);
      return authApi.me();
    },
    onSuccess: (user) => {
      forgetProvisionalPassword();
      setUser(user);
    },
  });
}

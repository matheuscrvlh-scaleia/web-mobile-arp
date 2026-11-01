import type { AuthUser, Permission, SessionResponse } from "@arp/contracts";
import { createContext, useContext } from "react";

export type AuthStatus = "loading" | "authenticated" | "anonymous";

/** Por que a pessoa está sem sessão (muda o aviso da tela de login). */
export type SignedOutReason = "expired" | "signed-out" | null;

export interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  signedOutReason: SignedOutReason;
  /** Guarda a sessão vinda do login. */
  signIn: (session: SessionResponse) => void;
  /** Encerra a sessão no servidor e aqui (todas as abas). */
  signOut: () => Promise<void>;
  /** Atualiza o usuário sem trocar o token (ex.: depois de trocar a senha). */
  setUser: (user: AuthUser) => void;
  /** null = qualquer usuário logado. */
  can: (permission: Permission | null) => boolean;
  canAny: (permissions: readonly Permission[]) => boolean;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de <AuthProvider>");
  return ctx;
}

/** Usuário logado (só dentro das rotas protegidas, onde ele sempre existe). */
export function useCurrentUser(): AuthUser {
  const { user } = useAuth();
  if (!user) throw new Error("useCurrentUser fora de uma rota protegida");
  return user;
}

export function usePermission(permission: Permission | null): boolean {
  return useAuth().can(permission);
}

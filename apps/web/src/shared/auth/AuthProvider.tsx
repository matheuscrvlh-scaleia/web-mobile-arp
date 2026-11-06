import { type AuthUser, type Permission, ROUTES, type SessionResponse } from "@arp/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  apiCall,
  onSessionEvent,
  refreshSession,
  refreshWasDisabled,
  setSession,
  signedOut,
} from "@/shared/api";
import {
  AuthContext,
  type AuthContextValue,
  type AuthStatus,
  type SignedOutReason,
} from "./auth-context";

/**
 * Sessão do painel. Ao abrir, tenta restaurar pelo cookie de refresh; depois
 * acompanha os eventos da sessão (renovou, expirou, saiu em outra aba).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUserState] = useState<AuthUser | null>(null);
  const [reason, setReason] = useState<SignedOutReason>(null);

  useEffect(() => {
    let alive = true;
    void refreshSession().then((session) => {
      if (!alive) return;
      if (session) {
        setUserState(session.user);
        setStatus("authenticated");
      } else {
        // Abriu o painel com a conta já desativada: o login diz o motivo.
        if (refreshWasDisabled()) setReason("disabled");
        setStatus("anonymous");
      }
    });
    const off = onSessionEvent((event) => {
      if (event.type === "refreshed") {
        // Cargo e permissões podem ter mudado: valem a partir daqui.
        setUserState(event.session.user);
        setStatus("authenticated");
        return;
      }
      setUserState(null);
      setStatus("anonymous");
      setReason(
        event.type === "expired" ? (event.disabled ? "disabled" : "expired") : "signed-out",
      );
      queryClient.clear();
    });
    return () => {
      alive = false;
      off();
    };
  }, [queryClient]);

  const signIn = useCallback((session: SessionResponse) => {
    setSession(session);
    setUserState(session.user);
    setReason(null);
    setStatus("authenticated");
  }, []);

  const signOut = useCallback(async () => {
    try {
      await apiCall(ROUTES.auth.logout);
    } catch {
      // Sem rede: a sessão local sai do mesmo jeito; o cookie vence sozinho.
    }
    signedOut();
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const perms = new Set<Permission>(user?.permissions ?? []);
    const can = (p: Permission | null) => user !== null && (p === null || perms.has(p));
    return {
      status,
      user,
      signedOutReason: reason,
      signIn,
      signOut,
      setUser: setUserState,
      can,
      canAny: (list) => list.some((p) => can(p)),
    };
  }, [status, user, reason, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

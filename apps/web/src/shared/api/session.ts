import { API_PREFIX, ROUTES, type SessionResponse, sessionResponseSchema } from "@arp/contracts";

// Sessão do painel. O access token fica SÓ em memória (nunca em
// localStorage: um XSS não o leva). O refresh token é um cookie httpOnly
// que o navegador manda sozinho para /api/v1/auth. Ao abrir o painel,
// refresh() restaura a sessão pelo cookie.

type Listener = (event: SessionEvent) => void;
export type SessionEvent =
  | { type: "refreshed"; session: SessionResponse }
  | { type: "expired" }
  | { type: "signed-out" };

let accessToken: string | null = null;
let inflight: Promise<SessionResponse | null> | null = null;
let renewTimer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<Listener>();

// Avisa as outras abas quando a pessoa sai (todas voltam ao login).
const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("arp-auth");
channel?.addEventListener("message", (e: MessageEvent<unknown>) => {
  if (e.data === "signed-out") {
    clearSession();
    emit({ type: "signed-out" });
  }
});

function emit(event: SessionEvent) {
  for (const l of listeners) l(event);
}

export function onSessionEvent(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const getAccessToken = () => accessToken;

/** Guarda a sessão nova e agenda a renovação 1 min antes de vencer. */
export function setSession(session: SessionResponse) {
  accessToken = session.accessToken;
  clearTimeout(renewTimer);
  const ms = Math.max((session.expiresIn - 60) * 1000, 10_000);
  renewTimer = setTimeout(() => {
    void refreshSession();
  }, ms);
}

export function clearSession() {
  accessToken = null;
  clearTimeout(renewTimer);
}

/** Saiu de propósito: limpa aqui e nas outras abas. */
export function signedOut() {
  clearSession();
  channel?.postMessage("signed-out");
  emit({ type: "signed-out" });
}

/** A renovação falhou no meio do uso: a tela leva ao login com ?next=. */
export function sessionExpired() {
  if (accessToken === null) return;
  clearSession();
  emit({ type: "expired" });
}

async function doRefresh(): Promise<SessionResponse | null> {
  try {
    const res = await fetch(`${API_PREFIX}${ROUTES.auth.refresh.path}`, {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const parsed = sessionResponseSchema.safeParse(await res.json());
    if (!parsed.success) return null;
    setSession(parsed.data);
    emit({ type: "refreshed", session: parsed.data });
    return parsed.data;
  } catch {
    return null;
  }
}

/**
 * Renova a sessão pelo cookie. Uma renovação só por vez, compartilhada por
 * todas as chamadas que levaram 401 juntas. Entre abas, a Web Lock evita
 * duas rotações simultâneas do mesmo refresh token (a API trataria a
 * segunda como roubo e derrubaria a família inteira).
 */
export function refreshSession(): Promise<SessionResponse | null> {
  if (!inflight) {
    const run = async (): Promise<SessionResponse | null> =>
      typeof navigator !== "undefined" && navigator.locks
        ? await navigator.locks.request("arp-refresh", doRefresh)
        : doRefresh();
    inflight = run().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

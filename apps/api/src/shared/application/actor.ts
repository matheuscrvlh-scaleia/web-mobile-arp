import type { Permission } from "@arp/contracts";

/** De onde veio a ação (vai para a auditoria). */
export interface RequestOrigin {
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
}

export const SYSTEM_ORIGIN: RequestOrigin = { ip: null, userAgent: null, requestId: null };

/** Usuário do painel, montado a partir do access token (sem consulta ao banco). */
export interface StaffActor {
  type: "staff";
  id: string;
  name: string;
  roleId: string;
  permissions: ReadonlySet<Permission>;
  /** Lojista: só enxerga e age sobre a própria loja. */
  storeId: string | null;
  /** Família da sessão (refresh) que emitiu o token. */
  sessionId: string;
  origin: RequestOrigin;
}

/** Visitante logado no app. */
export interface VisitorActor {
  type: "visitor";
  id: string;
  name: string;
  sessionId: string;
  origin: RequestOrigin;
}

/** Jobs e tarefas internas. */
export interface SystemActor {
  type: "system";
  id: null;
  name: string;
  origin: RequestOrigin;
}

export type Actor = StaffActor | VisitorActor | SystemActor;

export const systemActor = (name: string): SystemActor => ({
  type: "system",
  id: null,
  name,
  origin: SYSTEM_ORIGIN,
});

export function hasPermission(actor: Actor, permission: Permission): boolean {
  return actor.type === "staff" && actor.permissions.has(permission);
}

import type { Visitor } from "./visitor";

export interface VisitorRepository {
  /** Com trava de linha (bloqueio concorrente com login/refresh). */
  findByIdForUpdate(id: string): Promise<Visitor | null>;
  save(visitor: Visitor): Promise<void>;
}

/** Derruba os logins do app de um visitante (implementado pelas sessões do identity). */
export interface VisitorSessions {
  revokeAll(visitorId: string): Promise<void>;
}

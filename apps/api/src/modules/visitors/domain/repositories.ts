import type { Visitor } from "./visitor";

export interface VisitorRepository {
  /** Com trava de linha (bloqueio concorrente com login/refresh). */
  findByIdForUpdate(id: string): Promise<Visitor | null>;
  save(visitor: Visitor): Promise<void>;
  /**
   * Apaga os dados pessoais da linha (nome, e-mail, telefone, foto, apelido,
   * credenciais) e o que identifica o aparelho (push, códigos de senha).
   */
  erasePersonalData(visitor: Visitor): Promise<void>;
}

/** Derruba os logins do app de um visitante (implementado pelas sessões do identity). */
export interface VisitorSessions {
  revokeAll(visitorId: string): Promise<void>;
}

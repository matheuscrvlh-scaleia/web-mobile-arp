import type { Actor } from "../actor";

/** Quem fez (qualquer Actor serve; login usa o usuário recém-autenticado). */
export type AuditActor = Pick<Actor, "type" | "id" | "name" | "origin">;

export interface AuditEntry {
  actor: AuditActor;
  /** <entidade>.<ação> em snake_case, ex.: coupon.create, claim.redeem. */
  action: string;
  entityType: string;
  entityId: string | null;
  /** { campo: { from, to } } nas edições; snapshot nas criações. */
  changes?: Record<string, unknown> | null;
}

/** Grava na mesma transação da escrita (chame dentro de UnitOfWork.run). */
export interface AuditLogger {
  log(entry: AuditEntry): Promise<void>;
}

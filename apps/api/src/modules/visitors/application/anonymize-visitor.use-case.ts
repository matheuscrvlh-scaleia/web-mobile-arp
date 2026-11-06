import type { StaffActor } from "../../../shared/application/actor";
import type { AuditLogger } from "../../../shared/application/ports/audit-logger";
import type { Clock } from "../../../shared/application/ports/clock";
import type { UnitOfWork } from "../../../shared/application/ports/unit-of-work";
import { NotFoundError } from "../../../shared/domain/errors";
import type { VisitorRepository, VisitorSessions } from "../domain/repositories";
import { VISITOR_NOT_FOUND } from "./update-visitor-status.use-case";

export interface AnonymizeVisitorDeps {
  visitors: VisitorRepository;
  sessions: VisitorSessions;
  audit: AuditLogger;
  clock: Clock;
  uow: UnitOfWork;
}

/**
 * LGPD: apaga os dados pessoais do visitante (pedido do titular), derruba os
 * logins do app e registra no histórico com o motivo. Irreversível.
 */
export class AnonymizeVisitorUseCase {
  constructor(private readonly deps: AnonymizeVisitorDeps) {}

  async execute(input: { id: string; reason: string }, actor: StaffActor): Promise<void> {
    const { visitors, sessions, audit, clock, uow } = this.deps;
    await uow.run(async () => {
      const visitor = await visitors.findByIdForUpdate(input.id);
      if (!visitor) throw new NotFoundError(VISITOR_NOT_FOUND);
      visitor.anonymize(input.reason, clock.now());
      await visitors.erasePersonalData(visitor);
      await sessions.revokeAll(visitor.id);
      await audit.log({
        actor,
        action: "visitor.anonymize",
        entityType: "visitor",
        entityId: visitor.id,
        changes: { reason: input.reason.trim() },
      });
    });
  }
}

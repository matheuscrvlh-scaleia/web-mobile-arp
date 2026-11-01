import type { StaffActor } from "../../../shared/application/actor";
import { diff, hasChanges } from "../../../shared/application/audit-changes";
import type { AuditLogger } from "../../../shared/application/ports/audit-logger";
import type { UnitOfWork } from "../../../shared/application/ports/unit-of-work";
import { NotFoundError } from "../../../shared/domain/errors";
import type { VisitorRepository, VisitorSessions } from "../domain/repositories";
import type { VisitorStatus } from "../domain/visitor";

export interface UpdateVisitorStatusDeps {
  visitors: VisitorRepository;
  sessions: VisitorSessions;
  audit: AuditLogger;
  uow: UnitOfWork;
}

export const VISITOR_NOT_FOUND = "Visitante não encontrado";

/** Bloqueia (com motivo, derrubando os logins do app) ou desbloqueia um visitante. */
export class UpdateVisitorStatusUseCase {
  constructor(private readonly deps: UpdateVisitorStatusDeps) {}

  async execute(
    input: { id: string; status: VisitorStatus; reason?: string | null },
    actor: StaffActor,
  ): Promise<void> {
    const { visitors, sessions, audit, uow } = this.deps;
    await uow.run(async () => {
      const visitor = await visitors.findByIdForUpdate(input.id);
      if (!visitor) throw new NotFoundError(VISITOR_NOT_FOUND);
      const before = visitor.toState();
      if (input.status === "blocked") visitor.block(input.reason);
      else visitor.unblock();

      const changes = diff(before, visitor.toState());
      if (!hasChanges(changes)) return;
      await visitors.save(visitor);
      if (visitor.status === "blocked") await sessions.revokeAll(visitor.id);
      await audit.log({
        actor,
        action: visitor.status === "blocked" ? "visitor.block" : "visitor.unblock",
        entityType: "visitor",
        entityId: visitor.id,
        changes,
      });
    });
  }
}

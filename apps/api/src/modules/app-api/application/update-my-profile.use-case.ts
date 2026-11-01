import type { VisitorActor } from "../../../shared/application/actor";
import type { AuditLogger } from "../../../shared/application/ports/audit-logger";
import type { UnitOfWork } from "../../../shared/application/ports/unit-of-work";
import { definedFields } from "../../../shared/domain/patch";
import type { VisitorAccountRepository } from "../domain/repositories";
import type { VisitorProfileChanges } from "../domain/visitor-account";

/** Edita nome, telefone e o aceite de comunicação (LGPD: a mudança fica registrada). */
export class UpdateMyProfileUseCase {
  constructor(
    private readonly deps: {
      visitors: VisitorAccountRepository;
      audit: AuditLogger;
      uow: UnitOfWork;
    },
  ) {}

  async execute(changes: VisitorProfileChanges, actor: VisitorActor): Promise<void> {
    const defined = definedFields(changes);
    if (Object.keys(defined).length === 0) return;
    await this.deps.uow.run(async () => {
      await this.deps.visitors.updateProfile(actor.id, defined);
      await this.deps.audit.log({
        actor,
        action: "visitor.update_profile",
        entityType: "visitor",
        entityId: actor.id,
        changes: { ...defined },
      });
    });
  }
}

import type { StaffActor } from "../../../shared/application/actor";
import { diff, hasChanges } from "../../../shared/application/audit-changes";
import { NotFoundError } from "../../../shared/domain/errors";
import type { SealChanges } from "../domain/seal";
import { type GamificationDeps, SEAL_NOT_FOUND } from "./gamification-deps";

/** Edita ou arquiva (status) um selo. */
export class UpdateSealUseCase {
  constructor(private readonly deps: GamificationDeps) {}

  async execute(input: { id: string; changes: SealChanges }, actor: StaffActor): Promise<void> {
    const { seals, audit, uow } = this.deps;
    await uow.run(async () => {
      const seal = await seals.findById(input.id);
      if (!seal) throw new NotFoundError(SEAL_NOT_FOUND);
      const before = seal.toState();
      seal.update(input.changes);
      const changes = diff(before, seal.toState());
      if (!hasChanges(changes)) return;
      await seals.save(seal);
      await audit.log({
        actor,
        action: "seal.update",
        entityType: "seal",
        entityId: seal.id,
        changes,
      });
    });
  }
}

import type { StaffActor } from "../../../shared/application/actor";
import { diff, hasChanges } from "../../../shared/application/audit-changes";
import { NotFoundError } from "../../../shared/domain/errors";
import type { ChallengeChanges } from "../domain/challenge";
import {
  assertChallengeReferences,
  CHALLENGE_NOT_FOUND,
  couponStoreOf,
  type GamificationDeps,
} from "./gamification-deps";

export class UpdateChallengeUseCase {
  constructor(private readonly deps: GamificationDeps) {}

  async execute(
    input: { id: string; changes: ChallengeChanges },
    actor: StaffActor,
  ): Promise<void> {
    const { challenges, audit, uow } = this.deps;
    await uow.run(async () => {
      const challenge = await challenges.findById(input.id);
      if (!challenge) throw new NotFoundError(CHALLENGE_NOT_FOUND);
      await assertChallengeReferences(this.deps, input.changes);
      if (input.changes.sealId !== undefined && input.changes.sealId !== challenge.sealId) {
        challenge.assertSealChangeAllowed(
          input.changes.sealId,
          await challenges.countEarned(challenge.id),
        );
      }
      const before = challenge.toState();
      challenge.update(input.changes);
      // Gatilho de cupom: o desafio é da loja do cupom.
      const couponStore = await couponStoreOf(this.deps, challenge.couponId);
      if (couponStore) challenge.update({ storeId: couponStore });
      const changes = diff(before, challenge.toState());
      if (!hasChanges(changes)) return;
      await challenges.save(challenge);
      await audit.log({
        actor,
        action: "challenge.update",
        entityType: "challenge",
        entityId: challenge.id,
        changes,
      });
    });
  }
}

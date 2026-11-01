import type { StaffActor } from "../../../shared/application/actor";
import { snapshot } from "../../../shared/application/audit-changes";
import { NotFoundError } from "../../../shared/domain/errors";
import { CHALLENGE_NOT_FOUND, type GamificationDeps } from "./gamification-deps";

/** Apaga desafio que ainda não deu selo (os QR Codes vão junto, em cascata). */
export class DeleteChallengeUseCase {
  constructor(private readonly deps: GamificationDeps) {}

  async execute(input: { id: string }, actor: StaffActor): Promise<void> {
    const { challenges, audit, uow } = this.deps;
    await uow.run(async () => {
      const challenge = await challenges.findById(input.id);
      if (!challenge) throw new NotFoundError(CHALLENGE_NOT_FOUND);
      challenge.assertDeletable(await challenges.countEarned(challenge.id));
      await challenges.delete(challenge.id);
      await audit.log({
        actor,
        action: "challenge.delete",
        entityType: "challenge",
        entityId: challenge.id,
        changes: snapshot(challenge.toState()),
      });
    });
  }
}

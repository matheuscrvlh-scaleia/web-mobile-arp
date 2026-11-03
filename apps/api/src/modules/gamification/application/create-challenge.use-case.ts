import type { StaffActor } from "../../../shared/application/actor";
import { snapshot } from "../../../shared/application/audit-changes";
import { ValidationError } from "../../../shared/domain/errors";
import type { NewChallenge } from "../domain/challenge";
import {
  assertChallengeReferences,
  CAMPAIGN_NOT_FOUND,
  type GamificationDeps,
} from "./gamification-deps";

export type CreateChallengeInput = Omit<NewChallenge, "storeId" | "eventId" | "product"> & {
  storeId?: string | null;
  product?: string | null;
  eventId?: string | null;
};

export class CreateChallengeUseCase {
  constructor(private readonly deps: GamificationDeps) {}

  async execute(input: CreateChallengeInput, actor: StaffActor): Promise<string> {
    const { campaigns, challenges, audit, uow } = this.deps;
    const data: NewChallenge = {
      ...input,
      storeId: input.storeId ?? null,
      product: input.product ?? null,
      eventId: input.eventId ?? null,
    };
    return uow.run(async () => {
      if (!(await campaigns.findById(data.campaignId))) {
        throw ValidationError.field("campaignId", CAMPAIGN_NOT_FOUND);
      }
      await assertChallengeReferences(this.deps, data);
      const challenge = await challenges.create(data);
      await audit.log({
        actor,
        action: "challenge.create",
        entityType: "challenge",
        entityId: challenge.id,
        changes: snapshot(challenge.toState()),
      });
      return challenge.id;
    });
  }
}

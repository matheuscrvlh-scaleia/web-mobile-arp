import type { StaffActor } from "../../../shared/application/actor";
import { NotFoundError } from "../../../shared/domain/errors";
import { assertCompleteChallengeOrder } from "../domain/challenge";
import { CAMPAIGN_NOT_FOUND, type GamificationDeps } from "./gamification-deps";

/** Reordena os desafios da campanha de uma vez (arrastar na lista). */
export class ReorderChallengesUseCase {
  constructor(private readonly deps: GamificationDeps) {}

  async execute(input: { campaignId: string; ids: string[] }, actor: StaffActor): Promise<void> {
    const { campaigns, challenges, audit, uow } = this.deps;
    await uow.run(async () => {
      if (!(await campaigns.findById(input.campaignId))) {
        throw new NotFoundError(CAMPAIGN_NOT_FOUND);
      }
      const existing = await challenges.lockCampaignIds(input.campaignId);
      assertCompleteChallengeOrder(input.ids, existing);
      await challenges.applyOrder(input.ids);
      await audit.log({
        actor,
        action: "campaign.reorder_challenges",
        entityType: "campaign",
        entityId: input.campaignId,
        changes: { order: input.ids },
      });
    });
  }
}

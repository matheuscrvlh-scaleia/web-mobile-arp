import type { StaffActor } from "../../../shared/application/actor";
import { NotFoundError } from "../../../shared/domain/errors";
import { Campaign, type TierInput } from "../domain/campaign";
import { CAMPAIGN_NOT_FOUND, type GamificationDeps } from "./gamification-deps";

/** Substitui todas as faixas de benefício da campanha numa transação. */
export class ReplaceCampaignTiersUseCase {
  constructor(private readonly deps: GamificationDeps) {}

  async execute(input: { id: string; tiers: TierInput[] }, actor: StaffActor): Promise<void> {
    Campaign.assertValidTiers(input.tiers);
    const tiers = [...input.tiers].sort((a, b) => a.threshold - b.threshold);
    const { campaigns, audit, uow } = this.deps;
    await uow.run(async () => {
      const campaign = await campaigns.findById(input.id);
      if (!campaign) throw new NotFoundError(CAMPAIGN_NOT_FOUND);
      await campaigns.replaceTiers(campaign.id, tiers);
      await audit.log({
        actor,
        action: "campaign.replace_tiers",
        entityType: "campaign",
        entityId: campaign.id,
        changes: { tiers: { to: tiers } },
      });
    });
  }
}

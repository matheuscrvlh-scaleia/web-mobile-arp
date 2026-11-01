import type { StaffActor } from "../../../shared/application/actor";
import { diff, hasChanges } from "../../../shared/application/audit-changes";
import { NotFoundError } from "../../../shared/domain/errors";
import type { CampaignChanges } from "../domain/campaign";
import { CAMPAIGN_NOT_FOUND, type GamificationDeps } from "./gamification-deps";

/** Edita, publica ou arquiva (status) uma campanha; o período final é validado. */
export class UpdateCampaignUseCase {
  constructor(private readonly deps: GamificationDeps) {}

  async execute(input: { id: string; changes: CampaignChanges }, actor: StaffActor): Promise<void> {
    const { campaigns, audit, uow } = this.deps;
    await uow.run(async () => {
      const campaign = await campaigns.findById(input.id);
      if (!campaign) throw new NotFoundError(CAMPAIGN_NOT_FOUND);
      const before = campaign.toState();
      campaign.update(input.changes);
      const changes = diff(before, campaign.toState());
      if (!hasChanges(changes)) return;
      await campaigns.save(campaign);
      await audit.log({
        actor,
        action: "campaign.update",
        entityType: "campaign",
        entityId: campaign.id,
        changes,
      });
    });
  }
}

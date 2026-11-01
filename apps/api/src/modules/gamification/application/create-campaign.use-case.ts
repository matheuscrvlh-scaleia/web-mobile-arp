import type { StaffActor } from "../../../shared/application/actor";
import { snapshot } from "../../../shared/application/audit-changes";
import { Campaign, type NewCampaign } from "../domain/campaign";
import type { GamificationDeps } from "./gamification-deps";

export class CreateCampaignUseCase {
  constructor(private readonly deps: GamificationDeps) {}

  async execute(
    input: Omit<NewCampaign, "description"> & { description?: string | null },
    actor: StaffActor,
  ): Promise<string> {
    const data: NewCampaign = { ...input, description: input.description ?? null };
    Campaign.assertValidNew(data);
    const { campaigns, audit, uow } = this.deps;
    return uow.run(async () => {
      const campaign = await campaigns.create(data);
      await audit.log({
        actor,
        action: "campaign.create",
        entityType: "campaign",
        entityId: campaign.id,
        changes: snapshot(campaign.toState()),
      });
      return campaign.id;
    });
  }
}

import type { StaffActor } from "../../../shared/application/actor";
import { snapshot } from "../../../shared/application/audit-changes";
import { ConflictError, NotFoundError } from "../../../shared/domain/errors";
import { CAMPAIGN_NOT_FOUND, type GamificationDeps } from "./gamification-deps";

/**
 * Exclui campanha que ainda não deu selo, com os desafios, os QR Codes e as
 * faixas dela. Com selo dado, o histórico dos visitantes manda: arquive.
 */
export class DeleteCampaignUseCase {
  constructor(private readonly deps: GamificationDeps) {}

  async execute(input: { id: string }, actor: StaffActor): Promise<void> {
    const { campaigns, audit, uow } = this.deps;
    await uow.run(async () => {
      const campaign = await campaigns.findById(input.id);
      if (!campaign) throw new NotFoundError(CAMPAIGN_NOT_FOUND);
      const earned = await campaigns.countEarned(campaign.id);
      if (earned > 0) {
        throw new ConflictError(
          `Esta campanha já deu ${earned === 1 ? "1 selo" : `${earned} selos`}: arquive em vez de excluir. Quem ganhou mantém os selos.`,
        );
      }
      await campaigns.delete(campaign.id);
      await audit.log({
        actor,
        action: "campaign.delete",
        entityType: "campaign",
        entityId: campaign.id,
        changes: snapshot(campaign.toState()),
      });
    });
  }
}

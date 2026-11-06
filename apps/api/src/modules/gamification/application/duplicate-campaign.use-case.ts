import type { StaffActor } from "../../../shared/application/actor";
import { snapshot } from "../../../shared/application/audit-changes";
import { NotFoundError } from "../../../shared/domain/errors";
import { Campaign } from "../domain/campaign";
import { CAMPAIGN_NOT_FOUND, type GamificationDeps } from "./gamification-deps";

/**
 * Duplica a campanha (ex.: novembro → dezembro) numa transação: a cópia
 * nasce em rascunho, com as mesmas faixas e desafios (mesma ordem, selo,
 * loja, evento e situação), sem QR Codes. A janela própria de cada desafio
 * anda junto com o início da campanha.
 */
export class DuplicateCampaignUseCase {
  constructor(private readonly deps: GamificationDeps) {}

  async execute(
    input: { id: string; name: string; startsAt: Date; endsAt: Date },
    actor: StaffActor,
  ): Promise<string> {
    const { campaigns, challenges, audit, uow } = this.deps;
    return uow.run(async () => {
      const source = await campaigns.findById(input.id);
      if (!source) throw new NotFoundError(CAMPAIGN_NOT_FOUND);
      const from = source.toState();
      const data = {
        name: input.name,
        description: from.description,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        status: "draft" as const,
      };
      Campaign.assertValidNew(data);
      const copy = await campaigns.create(data);
      await campaigns.replaceTiers(copy.id, await campaigns.tiersOf(source.id));

      const shift = input.startsAt.getTime() - from.startsAt.getTime();
      const move = (d: Date | null) => (d ? new Date(d.getTime() + shift) : null);
      const list = await challenges.listByCampaign(source.id);
      for (const challenge of list) {
        const { id: _id, ...c } = challenge.toState();
        await challenges.create({
          ...c,
          campaignId: copy.id,
          availableFrom: move(c.availableFrom),
          availableUntil: move(c.availableUntil),
        });
      }

      await audit.log({
        actor,
        action: "campaign.duplicate",
        entityType: "campaign",
        entityId: copy.id,
        changes: {
          ...snapshot(copy.toState()),
          duplicatedFrom: source.id,
          challengesCopied: list.length,
        },
      });
      return copy.id;
    });
  }
}

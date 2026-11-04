import type { StaffActor } from "../../../shared/application/actor";
import { SealAlreadyEarnedError } from "../domain/errors";
import type { GamificationDeps } from "./gamification-deps";
import { addMonths } from "./scan-qr-code.use-case";

/** Selo dado pela baixa de um cupom. */
export interface CouponSealAward {
  earnedSealId: string;
  challengeId: string;
  sealName: string;
  points: number;
}

/**
 * Desafio automático "a loja deu baixa no cupom": roda dentro da transação
 * da baixa no caixa. Dá o selo de cada desafio ativo ligado ao cupom, com a
 * campanha no ar. Selo de uso único sai uma vez por pessoa; repetível sai a
 * cada baixa (cada pego só tem uma baixa).
 */
export class AwardCouponChallengesUseCase {
  constructor(private readonly deps: GamificationDeps) {}

  async execute(
    input: { couponId: string; claimId: string; visitorId: string },
    actor: StaffActor,
  ): Promise<CouponSealAward[]> {
    const { awards, audit, clock, uow } = this.deps;
    const now = clock.now();
    const awarded: CouponSealAward[] = [];
    for (const { challenge, campaign, seal, sealName } of await awards.findCouponChallenges(
      input.couponId,
    )) {
      if (!challenge.firesOnRedeemOf(input.couponId) || !campaign.isLiveAt(now)) continue;
      if (!seal.repeatable && (await awards.hasEarned(input.visitorId, challenge.id))) continue;
      let earnedSealId: string;
      try {
        // Savepoint: a corrida no unique não derruba a baixa do cupom.
        earnedSealId = await uow.run(() =>
          awards.award({
            visitorId: input.visitorId,
            challengeId: challenge.id,
            sealId: challenge.sealId,
            campaignId: campaign.id,
            qrCodeId: null,
            earnedAt: now,
            points: seal.points,
            expiresAt: addMonths(now, seal.validityMonths),
            repeatable: seal.repeatable,
            qrWindow: 0,
          }),
        );
      } catch (err) {
        if (err instanceof SealAlreadyEarnedError) continue;
        throw err;
      }
      await audit.log({
        actor,
        action: "seal.earn",
        entityType: "earned_seal",
        entityId: earnedSealId,
        changes: {
          challengeId: challenge.id,
          sealId: challenge.sealId,
          couponId: input.couponId,
          claimId: input.claimId,
          visitorId: input.visitorId,
          points: seal.points,
        },
      });
      awarded.push({ earnedSealId, challengeId: challenge.id, sealName, points: seal.points });
    }
    return awarded;
  }
}

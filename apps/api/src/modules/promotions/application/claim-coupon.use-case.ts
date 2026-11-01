import type { VisitorActor } from "../../../shared/application/actor";
import { NotFoundError } from "../../../shared/domain/errors";
import { CLAIM_CODE_ALPHABET, CLAIM_CODE_LENGTH, type Claim } from "../domain/claim";
import type { Coupon } from "../domain/coupon";
import {
  ClaimCodeCollisionError,
  CouponAlreadyClaimedError,
  CouponNotAvailableError,
  CouponSoldOutError,
} from "../domain/errors";
import type { PromotionsDeps } from "./promotions-deps";

const MAX_CODE_ATTEMPTS = 5;

/**
 * Visitante pega um cupom. Tudo numa transação com o cupom travado
 * (SELECT … FOR UPDATE): pedidos simultâneos do mesmo cupom fazem fila e
 * o estoque derivado nunca passa do total. Com o lock na mão são só três
 * idas ao banco (preparar, inserir, auditar) antes do commit: quanto menos
 * tempo segurando a linha, mais pegos por segundo no cupom disputado.
 */
export class ClaimCouponUseCase {
  constructor(private readonly deps: PromotionsDeps) {}

  async execute(
    input: { couponId: string },
    actor: VisitorActor,
  ): Promise<{ claimId: string; code: string; expiresAt: Date }> {
    const { coupons, claims, audit, clock, uow } = this.deps;
    return uow.run(async () => {
      const coupon = await coupons.findByIdForUpdate(input.couponId);
      if (!coupon) throw new NotFoundError("Cupom não encontrado");
      const now = clock.now();
      if (!coupon.isClaimableAt(now)) throw new CouponNotAvailableError();

      const slot = await claims.claimSlot(coupon.id, actor.id, now);
      if (slot.hasActive) throw new CouponAlreadyClaimedError();
      if (slot.taken >= coupon.totalQuantity) throw new CouponSoldOutError();

      const claim = await this.insertWithUniqueCode(coupon, actor.id, now);
      await audit.log({
        actor,
        action: "claim.create",
        entityType: "claim",
        entityId: claim.id,
        changes: {
          couponId: coupon.id,
          code: claim.code,
          expiresAt: claim.expiresAt.toISOString(),
        },
      });
      return { claimId: claim.id, code: claim.code, expiresAt: claim.expiresAt };
    });
  }

  private async insertWithUniqueCode(coupon: Coupon, visitorId: string, now: Date): Promise<Claim> {
    const { claims, random } = this.deps;
    for (let attempt = 1; ; attempt++) {
      const code = `ARP-${random.string(CLAIM_CODE_ALPHABET, CLAIM_CODE_LENGTH)}`;
      try {
        // Colisão de código volta como ClaimCodeCollisionError sem abortar a transação.
        return await claims.insert({
          couponId: coupon.id,
          visitorId,
          code,
          claimedAt: now,
          expiresAt: coupon.claimExpiresAt(now),
        });
      } catch (err) {
        if (!(err instanceof ClaimCodeCollisionError) || attempt >= MAX_CODE_ATTEMPTS) throw err;
      }
    }
  }
}

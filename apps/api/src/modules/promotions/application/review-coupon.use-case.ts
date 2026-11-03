import type { StaffActor } from "../../../shared/application/actor";
import { diff, hasChanges } from "../../../shared/application/audit-changes";
import { NotFoundError } from "../../../shared/domain/errors";
import { COUPON_NOT_FOUND, type PromotionsDeps } from "./promotions-deps";

/**
 * Revisão da ARP (Fase 2): aprova ou recusa (com motivo) o cupom do lojista.
 * Só cupom aprovado aparece no app. Quem revisa é a equipe (coupons.approve).
 */
export class ReviewCouponUseCase {
  constructor(private readonly deps: PromotionsDeps) {}

  async execute(
    input: { id: string; decision: "approve" | "reject"; note?: string | undefined },
    actor: StaffActor,
  ): Promise<void> {
    const { coupons, audit, uow } = this.deps;
    await uow.run(async () => {
      const coupon = await coupons.findByIdForUpdate(input.id);
      if (!coupon) throw new NotFoundError(COUPON_NOT_FOUND);
      const before = coupon.toState();
      coupon.decide(input.decision, input.note ?? null);
      const changes = diff(before, coupon.toState());
      if (!hasChanges(changes)) return;
      await coupons.save(coupon);
      await audit.log({
        actor,
        action: input.decision === "approve" ? "coupon.approve" : "coupon.reject",
        entityType: "coupon",
        entityId: coupon.id,
        changes,
      });
    });
  }
}

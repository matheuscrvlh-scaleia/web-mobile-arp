import type { StaffActor } from "../../../shared/application/actor";
import { diff, hasChanges } from "../../../shared/application/audit-changes";
import { assertStoreAccess } from "../../../shared/application/store-scope";
import { NotFoundError } from "../../../shared/domain/errors";
import type { CouponStatus } from "../domain/coupon";
import { COUPON_NOT_FOUND, type PromotionsDeps } from "./promotions-deps";

/** Ativar, pausar ou encerrar (regras de transição na entidade Coupon). */
export class ChangeCouponStatusUseCase {
  constructor(private readonly deps: PromotionsDeps) {}

  async execute(input: { id: string; status: CouponStatus }, actor: StaffActor): Promise<void> {
    const { coupons, audit, clock, uow } = this.deps;
    await uow.run(async () => {
      const coupon = await coupons.findByIdForUpdate(input.id);
      if (!coupon) throw new NotFoundError(COUPON_NOT_FOUND);
      assertStoreAccess(actor, coupon.storeId);

      const before = coupon.toState();
      coupon.changeStatus(input.status, clock.now());
      const changes = diff(before, coupon.toState());
      if (!hasChanges(changes)) return;
      await coupons.save(coupon);
      await audit.log({
        actor,
        action: "coupon.change_status",
        entityType: "coupon",
        entityId: coupon.id,
        changes,
      });
    });
  }
}

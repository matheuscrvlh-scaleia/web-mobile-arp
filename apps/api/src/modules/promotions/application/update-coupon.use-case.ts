import type { StaffActor } from "../../../shared/application/actor";
import { diff, hasChanges } from "../../../shared/application/audit-changes";
import { replacedImageUrls } from "../../../shared/application/image-variants";
import { assertStoreAccess } from "../../../shared/application/store-scope";
import { NotFoundError } from "../../../shared/domain/errors";
import type { CouponChanges } from "../domain/coupon";
import { COUPON_NOT_FOUND, type PromotionsDeps } from "./promotions-deps";

/** Edita só os campos enviados. O total nunca fica abaixo do que já foi pego. */
export class UpdateCouponUseCase {
  constructor(private readonly deps: PromotionsDeps) {}

  async execute(input: { id: string; changes: CouponChanges }, actor: StaffActor): Promise<void> {
    const { coupons, audit, clock, uow, images } = this.deps;
    const replaced = await uow.run(async () => {
      // Trava o cupom: um pego simultâneo não fura a checagem do total.
      const coupon = await coupons.findByIdForUpdate(input.id);
      if (!coupon) throw new NotFoundError(COUPON_NOT_FOUND);
      assertStoreAccess(actor, coupon.storeId);

      const before = coupon.toState();
      const taken =
        input.changes.totalQuantity !== undefined
          ? await coupons.countTaken(coupon.id, clock.now())
          : 0;
      coupon.update(input.changes, taken);
      const changes = diff(before, coupon.toState());
      if (!hasChanges(changes)) return [];
      await coupons.save(coupon);
      await audit.log({
        actor,
        action: "coupon.update",
        entityType: "coupon",
        entityId: coupon.id,
        changes,
      });
      return replacedImageUrls(before, coupon.toState(), ["imageUrl"]);
    });
    await images.discard(replaced);
  }
}

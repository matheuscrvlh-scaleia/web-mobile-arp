import type { StaffActor } from "../../../shared/application/actor";
import { diff, hasChanges } from "../../../shared/application/audit-changes";
import { assertStoreAccess } from "../../../shared/application/store-scope";
import { NotFoundError } from "../../../shared/domain/errors";
import { COUPON_NOT_FOUND, type PromotionsDeps } from "./promotions-deps";

/** Arquiva (some das listas, guarda o histórico) ou desarquiva. Regras na entidade. */
export class ArchiveCouponUseCase {
  constructor(private readonly deps: PromotionsDeps) {}

  async execute(input: { id: string; archived: boolean }, actor: StaffActor): Promise<void> {
    const { coupons, audit, clock, uow } = this.deps;
    await uow.run(async () => {
      const coupon = await coupons.findByIdForUpdate(input.id);
      if (!coupon) throw new NotFoundError(COUPON_NOT_FOUND);
      assertStoreAccess(actor, coupon.storeId);

      const before = coupon.toState();
      if (input.archived) coupon.archive(clock.now());
      else coupon.unarchive();
      const changes = diff(before, coupon.toState());
      if (!hasChanges(changes)) return;
      await coupons.save(coupon);
      await audit.log({
        actor,
        action: input.archived ? "coupon.archive" : "coupon.unarchive",
        entityType: "coupon",
        entityId: coupon.id,
        changes,
      });
    });
  }
}

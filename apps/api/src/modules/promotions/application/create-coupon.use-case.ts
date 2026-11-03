import type { StaffActor } from "../../../shared/application/actor";
import { snapshot } from "../../../shared/application/audit-changes";
import { scopedStoreId } from "../../../shared/application/store-scope";
import { ValidationError } from "../../../shared/domain/errors";
import { Coupon, type CouponTone, type NewCoupon } from "../domain/coupon";
import type { PromotionsDeps } from "./promotions-deps";

export interface CreateCouponInput {
  storeId: string;
  title: string;
  headline: string;
  headlineSub?: string | null;
  description?: string | null;
  scheduleNote?: string | null;
  startsAt: Date;
  endsAt?: Date | null;
  totalQuantity: number;
  redeemWindowHours: number;
  tone: CouponTone;
  icon: string;
  imageUrl?: string | null;
  savingsCents?: number | null;
  status: "draft" | "active";
  weekdays: number[];
}

/** Cria uma promoção. Lojista só cria na própria loja. */
export class CreateCouponUseCase {
  constructor(private readonly deps: PromotionsDeps) {}

  async execute(input: CreateCouponInput, actor: StaffActor): Promise<string> {
    const { coupons, stores, audit, clock, uow } = this.deps;
    const storeId = scopedStoreId(actor, input.storeId) ?? input.storeId;
    const data: NewCoupon = {
      storeId,
      title: input.title,
      headline: input.headline,
      headlineSub: input.headlineSub ?? null,
      description: input.description ?? null,
      scheduleNote: input.scheduleNote ?? null,
      startsAt: input.startsAt,
      endsAt: input.endsAt ?? null,
      totalQuantity: input.totalQuantity,
      redeemWindowHours: input.redeemWindowHours,
      tone: input.tone,
      icon: input.icon,
      imageUrl: input.imageUrl ?? null,
      savingsCents: input.savingsCents ?? null,
      status: input.status,
      weekdays: input.weekdays,
      // Cupom do lojista espera a ARP; o da equipe da ARP já nasce aprovado.
      review: actor.storeId ? "pending" : "approved",
      reviewNote: null,
      createdBy: actor.id,
    };
    Coupon.assertValidNew(data, clock.now());

    return uow.run(async () => {
      if (!(await stores.exists(storeId))) {
        throw ValidationError.field("storeId", "Loja não encontrada");
      }
      const coupon = await coupons.create(data);
      await audit.log({
        actor,
        action: "coupon.create",
        entityType: "coupon",
        entityId: coupon.id,
        changes: snapshot(coupon.toState()),
      });
      return coupon.id;
    });
  }
}

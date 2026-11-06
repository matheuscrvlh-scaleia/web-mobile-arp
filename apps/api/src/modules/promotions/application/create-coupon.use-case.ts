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
  expiresWithPromotion: boolean;
  useUntil?: Date | null;
  tone: CouponTone;
  icon: string;
  imageUrl?: string | null;
  savingsCents?: number | null;
  status: "draft" | "active";
  weekdays: number[];
}

/** A mesma promoção para várias lojas (Black Friday): uma por loja. */
export type CreateCouponsInput = Omit<CreateCouponInput, "storeId"> & { storeIds: string[] };

function newCoupon(input: CreateCouponInput, storeId: string, actor: StaffActor): NewCoupon {
  return {
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
    expiresWithPromotion: input.expiresWithPromotion,
    useUntil: input.useUntil ?? null,
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
}

/** Grava um cupom já validado (dentro da transação de quem chama). */
async function insert(deps: PromotionsDeps, data: NewCoupon, actor: StaffActor): Promise<string> {
  if (!(await deps.stores.exists(data.storeId))) {
    throw ValidationError.field("storeId", "Loja não encontrada");
  }
  const coupon = await deps.coupons.create(data);
  await deps.audit.log({
    actor,
    action: "coupon.create",
    entityType: "coupon",
    entityId: coupon.id,
    changes: snapshot(coupon.toState()),
  });
  return coupon.id;
}

/** Cria uma promoção. Lojista só cria na própria loja. */
export class CreateCouponUseCase {
  constructor(private readonly deps: PromotionsDeps) {}

  async execute(input: CreateCouponInput, actor: StaffActor): Promise<string> {
    const storeId = scopedStoreId(actor, input.storeId) ?? input.storeId;
    const data = newCoupon(input, storeId, actor);
    Coupon.assertValidNew(data, this.deps.clock.now());
    return this.deps.uow.run(() => insert(this.deps, data, actor));
  }
}

/**
 * Cria a mesma promoção para várias lojas numa transação só: ou todas, ou
 * nenhuma (loja inexistente desfaz tudo). Lojista só na própria loja.
 */
export class CreateCouponsUseCase {
  constructor(private readonly deps: PromotionsDeps) {}

  async execute(input: CreateCouponsInput, actor: StaffActor): Promise<string[]> {
    const { storeIds, ...fields } = input;
    const now = this.deps.clock.now();
    const items = storeIds.map((requested) => {
      const storeId = scopedStoreId(actor, requested) ?? requested;
      const data = newCoupon({ ...fields, storeId }, storeId, actor);
      Coupon.assertValidNew(data, now);
      return data;
    });
    return this.deps.uow.run(async () => {
      const ids: string[] = [];
      for (const data of items) ids.push(await insert(this.deps, data, actor));
      return ids;
    });
  }
}

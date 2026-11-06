import type { StaffActor } from "../../../shared/application/actor";
import { snapshot } from "../../../shared/application/audit-changes";
import { assertStoreAccess } from "../../../shared/application/store-scope";
import { ConflictError, NotFoundError } from "../../../shared/domain/errors";
import type { CouponUsage } from "../domain/repositories";
import { COUPON_NOT_FOUND, type PromotionsDeps } from "./promotions-deps";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Por que não dá para excluir, em português de gente (null = pode). */
export function couponInUseMessage(usage: CouponUsage): string | null {
  if (usage.claims > 0) {
    return `Já ${usage.claims === 1 ? "foi pego" : "foram pegos"} ${plural(usage.claims, "cupom", "cupons")}: arquive em vez de excluir.`;
  }
  if (usage.challenges > 0) {
    return `${plural(usage.challenges, "desafio dá", "desafios dão")} selo quando este cupom é usado. Troque o cupom do desafio antes de excluir.`;
  }
  if (usage.highlights > 0) {
    return `${plural(usage.highlights, "destaque do app leva", "destaques do app levam")} a esta promoção. Mude o destino do destaque antes de excluir.`;
  }
  return null;
}

/**
 * Exclui de vez só a promoção que ninguém pegou (rascunho de teste, criada
 * por engano). Com histórico: 409 pedindo para arquivar.
 */
export class DeleteCouponUseCase {
  constructor(private readonly deps: PromotionsDeps) {}

  async execute(input: { id: string }, actor: StaffActor): Promise<void> {
    const { coupons, audit, uow, images } = this.deps;
    const image = await uow.run(async () => {
      const coupon = await coupons.findByIdForUpdate(input.id);
      if (!coupon) throw new NotFoundError(COUPON_NOT_FOUND);
      assertStoreAccess(actor, coupon.storeId);

      const reason = couponInUseMessage(await coupons.usage(coupon.id));
      if (reason) throw new ConflictError(reason);
      const state = coupon.toState();
      await coupons.remove(coupon.id);
      await audit.log({
        actor,
        action: "coupon.delete",
        entityType: "coupon",
        entityId: coupon.id,
        changes: snapshot(state),
      });
      return state.imageUrl;
    });
    // Só some do armazenamento se nenhuma outra linha usa a mesma imagem (cópias).
    await images.discard(image ? [image] : []);
  }
}

import type { StaffActor } from "../../../shared/application/actor";
import type { ImageCleanup } from "../../../shared/application/image-variants";
import type { AuditLogger } from "../../../shared/application/ports/audit-logger";
import type { Clock } from "../../../shared/application/ports/clock";
import type { SecureRandom } from "../../../shared/application/ports/secure-random";
import type { UnitOfWork } from "../../../shared/application/ports/unit-of-work";
import type { ClaimRepository, CouponRepository, StoreLookup } from "../domain/repositories";

export interface PromotionsDeps {
  coupons: CouponRepository;
  claims: ClaimRepository;
  stores: StoreLookup;
  random: SecureRandom;
  audit: AuditLogger;
  clock: Clock;
  uow: UnitOfWork;
  /** Apaga a imagem trocada depois do commit. */
  images: ImageCleanup;
  /**
   * Depois da baixa no caixa, na mesma transação (ex.: selo do desafio
   * automático ligado ao cupom). Falhou, a baixa volta junto.
   */
  onRedeemed?: (
    redeemed: { claimId: string; couponId: string; visitorId: string },
    actor: StaffActor,
  ) => Promise<unknown>;
}

export const COUPON_NOT_FOUND = "Promoção não encontrada";

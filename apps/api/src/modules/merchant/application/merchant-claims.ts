import type { App, CouponClaim } from "@arp/contracts";
import type { LookupClaimUseCase, RedeemClaimUseCase } from "../../promotions";
import { firstNameOf } from "../domain/merchant";
import type { MerchantStoreReader } from "./merchant-scope";

/** O que o caixa do app usa do módulo de promoções (os casos de uso do painel). */
export interface MerchantClaimsDeps {
  lookup: Pick<LookupClaimUseCase, "execute">;
  redeem: Pick<RedeemClaimUseCase, "execute">;
  claimById(id: string): Promise<CouponClaim | null>;
  stores: MerchantStoreReader;
}

/** Pego do painel → visão do caixa: do visitante, só o primeiro nome. */
export function toMerchantClaim(claim: CouponClaim): App.MerchantClaim {
  return {
    id: claim.id,
    code: claim.code,
    status: claim.status,
    claimedAt: claim.claimedAt,
    expiresAt: claim.expiresAt,
    redeemedAt: claim.redeemedAt,
    coupon: claim.coupon,
    store: claim.store,
    visitor: { firstName: firstNameOf(claim.visitor.name) },
  };
}

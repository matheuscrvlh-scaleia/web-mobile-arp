import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { CoreDeps } from "../../shared/infra/core";
import { createImageCleanup } from "../../shared/infra/images";
import type { Job } from "../../shared/infra/jobs/scheduler";
import { ChangeCouponStatusUseCase } from "./application/change-coupon-status.use-case";
import { ClaimCouponUseCase } from "./application/claim-coupon.use-case";
import { CreateCouponUseCase } from "./application/create-coupon.use-case";
import { ExpireOverdueClaimsUseCase } from "./application/expire-overdue-claims.use-case";
import { LookupClaimUseCase } from "./application/lookup-claim.use-case";
import type { PromotionsDeps } from "./application/promotions-deps";
import { RedeemClaimUseCase } from "./application/redeem-claim.use-case";
import { ReviewCouponUseCase } from "./application/review-coupon.use-case";
import { UpdateCouponUseCase } from "./application/update-coupon.use-case";
import { promotionsRoutes } from "./http/promotions.routes";
import {
  PgClaimRepository,
  PgCouponRepository,
  PgStoreLookup,
} from "./infra/pg-promotions-repositories";
import { PromotionsQueries } from "./infra/promotions.queries";

export type { ClaimCouponUseCase } from "./application/claim-coupon.use-case";
export type { LookupClaimUseCase } from "./application/lookup-claim.use-case";
export type { RedeemClaimUseCase } from "./application/redeem-claim.use-case";

export function createPromotionsModule(
  core: CoreDeps,
  hooks: Pick<PromotionsDeps, "onRedeemed"> = {},
) {
  const { db, uow, clock, random, audit } = core;
  const claims = new PgClaimRepository(db);
  const deps: PromotionsDeps = {
    coupons: new PgCouponRepository(db),
    claims,
    stores: new PgStoreLookup(db),
    random,
    audit,
    clock,
    uow,
    images: createImageCleanup(core),
    onRedeemed: hooks.onRedeemed,
  };
  const queries = new PromotionsQueries(db, clock);
  const claimCoupon = new ClaimCouponUseCase(deps);
  const expireOverdue = new ExpireOverdueClaimsUseCase({ claims, clock });

  const lookupClaim = new LookupClaimUseCase({ reader: queries });
  const redeemClaim = new RedeemClaimUseCase(deps);

  const routes: FastifyPluginAsyncZod = promotionsRoutes({
    queries,
    createCoupon: new CreateCouponUseCase(deps),
    updateCoupon: new UpdateCouponUseCase(deps),
    changeCouponStatus: new ChangeCouponStatusUseCase(deps),
    reviewCoupon: new ReviewCouponUseCase(deps),
    lookupClaim,
    redeemClaim,
  });

  const expireJob: Job = {
    name: "expire-coupon-claims",
    intervalMs: 60_000,
    async run() {
      const expired = await expireOverdue.execute();
      if (expired > 0)
        core.logger.info({ expired }, "Cupons pegos vencidos marcados como expirados");
    },
  };

  return {
    routes,
    claimCoupon,
    // Caixa do lojista no app: mesmos casos de uso (e erros) do painel.
    lookupClaim,
    redeemClaim,
    claimById: (id: string) => queries.claimById(id),
    jobs: [expireJob],
  };
}

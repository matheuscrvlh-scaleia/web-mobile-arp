import {
  changeCouponStatusBodySchema,
  couponClaimPageSchema,
  couponClaimSchema,
  couponPageSchema,
  couponSchema,
  createCouponBodySchema,
  idParamsSchema,
  listClaimsQuerySchema,
  listCouponsQuerySchema,
  lookupClaimQuerySchema,
  ROUTES,
  redeemClaimBodySchema,
  reviewCouponBodySchema,
  updateCouponBodySchema,
} from "@arp/contracts";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { APP_CONTENT_CACHE_PREFIX } from "../../../shared/application/ports/cache";
import { assertStoreAccess, scopedStoreId } from "../../../shared/application/store-scope";
import { orNotFound } from "../../../shared/domain/errors";
import { staffOf } from "../../../shared/infra/http/auth";
import { actorRateLimitKey } from "../../../shared/infra/http/rate-limit";
import { createRouter } from "../../../shared/infra/http/router";
import { toDate } from "../../../shared/infra/presenters";
import type { ChangeCouponStatusUseCase } from "../application/change-coupon-status.use-case";
import type { CreateCouponUseCase } from "../application/create-coupon.use-case";
import type { LookupClaimUseCase } from "../application/lookup-claim.use-case";
import { COUPON_NOT_FOUND } from "../application/promotions-deps";
import { CODE_NOT_FOUND, type RedeemClaimUseCase } from "../application/redeem-claim.use-case";
import type { ReviewCouponUseCase } from "../application/review-coupon.use-case";
import type { UpdateCouponUseCase } from "../application/update-coupon.use-case";
import type { PromotionsQueries } from "../infra/promotions.queries";

export interface PromotionsRoutesDeps {
  queries: PromotionsQueries;
  createCoupon: CreateCouponUseCase;
  updateCoupon: UpdateCouponUseCase;
  changeCouponStatus: ChangeCouponStatusUseCase;
  reviewCoupon: ReviewCouponUseCase;
  lookupClaim: LookupClaimUseCase;
  redeemClaim: RedeemClaimUseCase;
}

export function promotionsRoutes(deps: PromotionsRoutesDeps): FastifyPluginAsyncZod {
  const { queries } = deps;
  const coupon = async (id: string) => orNotFound(await queries.getCoupon(id), COUPON_NOT_FOUND);

  // Caixa digitando códigos: freia tentativa em massa por usuário da equipe.
  const codeAttempts = (name: string) => ({
    max: 120,
    timeWindow: "1 minute",
    keyGenerator: actorRateLimitKey(`claims-${name}`),
  });

  return async (app) => {
    const r = createRouter(app, {
      audience: "admin",
      tag: "Cupons",
      // Escrita aqui muda o que o app mostra: limpa as leituras compartilhadas.
      invalidates: [APP_CONTENT_CACHE_PREFIX],
    });

    r.route(
      ROUTES.coupons.list,
      { querystring: listCouponsQuerySchema, response: { 200: couponPageSchema } },
      async (request) => {
        const storeId = scopedStoreId(staffOf(request), request.query.storeId);
        return queries.listCoupons({ ...request.query, storeId });
      },
    );

    r.route(
      ROUTES.coupons.get,
      { params: idParamsSchema, response: { 200: couponSchema } },
      async (request) => {
        const found = await coupon(request.params.id);
        assertStoreAccess(staffOf(request), found.store.id);
        return found;
      },
    );

    r.route(
      ROUTES.coupons.create,
      { body: createCouponBodySchema, response: { 201: couponSchema } },
      async (request, reply) => {
        const { startsAt, endsAt, useUntil, ...body } = request.body;
        const id = await deps.createCoupon.execute(
          {
            ...body,
            startsAt: toDate(startsAt),
            endsAt: toDate(endsAt),
            useUntil: toDate(useUntil),
          },
          staffOf(request),
        );
        return reply.status(201).send(await coupon(id));
      },
    );

    r.route(
      ROUTES.coupons.update,
      { params: idParamsSchema, body: updateCouponBodySchema, response: { 200: couponSchema } },
      async (request) => {
        const { startsAt, endsAt, useUntil, ...changes } = request.body;
        await deps.updateCoupon.execute(
          {
            id: request.params.id,
            changes: {
              ...changes,
              startsAt: toDate(startsAt),
              endsAt: toDate(endsAt),
              useUntil: toDate(useUntil),
            },
          },
          staffOf(request),
        );
        return coupon(request.params.id);
      },
    );

    r.route(
      ROUTES.coupons.changeStatus,
      {
        params: idParamsSchema,
        body: changeCouponStatusBodySchema,
        response: { 200: couponSchema },
      },
      async (request) => {
        await deps.changeCouponStatus.execute(
          { id: request.params.id, status: request.body.status },
          staffOf(request),
        );
        return coupon(request.params.id);
      },
    );

    r.route(
      ROUTES.coupons.review,
      { params: idParamsSchema, body: reviewCouponBodySchema, response: { 200: couponSchema } },
      async (request) => {
        await deps.reviewCoupon.execute(
          { id: request.params.id, ...request.body },
          staffOf(request),
        );
        return coupon(request.params.id);
      },
    );

    r.route(
      ROUTES.claims.list,
      { querystring: listClaimsQuerySchema, response: { 200: couponClaimPageSchema } },
      async (request) => {
        const storeId = scopedStoreId(staffOf(request), request.query.storeId);
        return queries.listClaims({ ...request.query, storeId });
      },
    );

    r.route(
      ROUTES.claims.lookup,
      { querystring: lookupClaimQuerySchema, response: { 200: couponClaimSchema } },
      async (request) => deps.lookupClaim.execute(request.query, staffOf(request)),
      { rateLimit: codeAttempts("lookup") },
    );

    r.route(
      ROUTES.claims.redeem,
      { body: redeemClaimBodySchema, response: { 200: couponClaimSchema } },
      async (request) => {
        const { claimId } = await deps.redeemClaim.execute(request.body, staffOf(request));
        return orNotFound(await queries.claimById(claimId), CODE_NOT_FOUND);
      },
      // Usar o código não muda o estoque nem o que o app mostra (usado já contava).
      { rateLimit: codeAttempts("redeem"), invalidates: false },
    );
  };
}

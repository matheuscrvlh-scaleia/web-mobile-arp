import { App, idParamsSchema } from "@arp/contracts";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { Clock } from "../../../shared/application/ports/clock";
import { orNotFound } from "../../../shared/domain/errors";
import { visitorOf } from "../../../shared/infra/http/auth";
import { actorRateLimitKey } from "../../../shared/infra/http/rate-limit";
import { createRouter, type RouteExtras } from "../../../shared/infra/http/router";
import type { ScanQrCodeUseCase } from "../../gamification";
import type { ClaimCouponUseCase } from "../../promotions";
import type { AppReads } from "../infra/app-reads";
import type { FeedQueries } from "../infra/feed.queries";
import type { VisitorQueries } from "../infra/visitor.queries";
import { renderEventSharePage } from "./event-share-page";
import type { OptionalVisitor } from "./optional-visitor";

export interface AppBrowseRoutesDeps {
  reads: AppReads;
  feed: FeedQueries;
  visitors: VisitorQueries;
  claimCoupon: ClaimCouponUseCase;
  scanQrCode: ScanQrCodeUseCase;
  optionalVisitor: OptionalVisitor;
  clock: Clock;
  /** max-age das respostas públicas para anônimos (0 = sem cache público). */
  publicMaxAgeSeconds: number;
  /** Limite por visitante de pegar cupom / ler QR. */
  actionRateLimit: { max: number; timeWindow: string; distributed: boolean };
}

const { APP_ROUTES } = App;

/** Navegação do app (pública, personalizada com login) e as ações de pegar cupom e ler QR. */
export function appBrowseRoutes(deps: AppBrowseRoutesDeps): FastifyPluginAsyncZod {
  const { reads, feed, visitors, optionalVisitor, clock } = deps;
  // Leitura pública: anônimo pode guardar por max-age; logado revalida (ETag).
  const shared: RouteExtras = deps.publicMaxAgeSeconds
    ? { httpCache: { publicMaxAgeSeconds: deps.publicMaxAgeSeconds } }
    : {};
  const action = (name: string): RouteExtras => ({
    rateLimit: {
      max: deps.actionRateLimit.max,
      timeWindow: deps.actionRateLimit.timeWindow,
      distributed: deps.actionRateLimit.distributed,
      keyGenerator: actorRateLimitKey(name),
    },
  });

  return async (app) => {
    const r = createRouter(app, { audience: "app", tag: "App: navegação" });

    r.route(
      APP_ROUTES.home,
      { response: { 200: App.homeSchema } },
      async (request) => {
        const visitorId = await optionalVisitor(request);
        const now = clock.now();
        const home = await reads.homeShared(now);
        return {
          ...home,
          summary: visitorId ? await visitors.monthSummary(visitorId, now) : null,
        };
      },
      shared,
    );

    r.route(
      APP_ROUTES.stores.categories,
      { response: { 200: App.storeCategoryListSchema } },
      async () => ({ data: await reads.categories() }),
      shared,
    );

    r.route(
      APP_ROUTES.stores.list,
      { querystring: App.listStoresQuerySchema, response: { 200: App.storePageSchema } },
      async (request) => reads.stores(request.query, await optionalVisitor(request), clock.now()),
      shared,
    );

    r.route(
      APP_ROUTES.stores.get,
      { params: App.storeParamsSchema, response: { 200: App.storeDetailSchema } },
      async (request) => {
        const store = await reads.store(
          request.params.idOrSlug,
          await optionalVisitor(request),
          clock.now(),
        );
        return orNotFound(store, "Loja não encontrada");
      },
      shared,
    );

    r.route(APP_ROUTES.map, { response: { 200: App.mapSchema } }, async () => reads.map(), shared);

    r.route(
      APP_ROUTES.agenda.days,
      { querystring: App.agendaQuerySchema, response: { 200: App.agendaSchema } },
      async (request) => reads.agenda(request.query),
      shared,
    );

    // Página pública para compartilhar no WhatsApp (prévia com foto pelas tags Open Graph).
    r.route(APP_ROUTES.agenda.share, { params: idParamsSchema }, async (request, reply) => {
      const event = orNotFound(
        await reads.event(request.params.id, null, clock.now()),
        "Evento não encontrado",
      );
      const origin = `${request.protocol}://${request.host}`;
      return reply
        .header("cache-control", "public, max-age=300")
        .type("text/html; charset=utf-8")
        .send(renderEventSharePage(event, origin));
    });

    r.route(
      APP_ROUTES.agenda.get,
      { params: idParamsSchema, response: { 200: App.eventDetailSchema } },
      async (request) => {
        const event = await reads.event(
          request.params.id,
          await optionalVisitor(request),
          clock.now(),
        );
        return orNotFound(event, "Evento não encontrado");
      },
      shared,
    );

    r.route(
      APP_ROUTES.coupons.list,
      { querystring: App.listCouponsQuerySchema, response: { 200: App.couponPageSchema } },
      async (request) => reads.coupons(request.query, clock.now()),
      shared,
    );

    r.route(
      APP_ROUTES.coupons.get,
      { params: idParamsSchema, response: { 200: App.couponDetailSchema } },
      async (request) => {
        const coupon = await reads.coupon(
          request.params.id,
          await optionalVisitor(request),
          clock.now(),
        );
        return orNotFound(coupon, "Cupom não encontrado");
      },
      shared,
    );

    r.route(
      APP_ROUTES.coupons.claim,
      { params: idParamsSchema, response: { 201: App.claimSchema } },
      async (request, reply) => {
        const visitor = visitorOf(request);
        const { claimId } = await deps.claimCoupon.execute(
          { couponId: request.params.id },
          visitor,
        );
        deps.reads.forgetCoupon(request.params.id);
        const claim = await feed.claim(claimId, visitor.id, clock.now());
        return reply.status(201).send(orNotFound(claim, "Cupom não encontrado"));
      },
      action("claim"),
    );

    // Situação atual de um pego (o app consulta enquanto o código está na tela do caixa).
    r.route(
      APP_ROUTES.me.claim,
      { params: idParamsSchema, response: { 200: App.claimSchema } },
      async (request) =>
        orNotFound(
          await feed.claim(request.params.id, visitorOf(request).id, clock.now()),
          "Cupom não encontrado",
        ),
    );

    r.route(
      APP_ROUTES.challenges.list,
      { response: { 200: App.challengesSchema } },
      async (request) => reads.challenges(await optionalVisitor(request), clock.now()),
      shared,
    );

    r.route(
      APP_ROUTES.challenges.scan,
      { body: App.scanQrBodySchema, response: { 201: App.scanResultSchema } },
      async (request, reply) => {
        const visitor = visitorOf(request);
        const awarded = await deps.scanQrCode.execute(request.body, visitor);
        const result = await visitors.scanResult(visitor.id, awarded.earnedSealId);
        return reply.status(201).send(orNotFound(result, "Selo não encontrado"));
      },
      action("scan"),
    );
  };
}

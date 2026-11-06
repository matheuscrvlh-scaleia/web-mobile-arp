import {
  App,
  counterRedeemBodySchema,
  counterRedeemResultSchema,
  couponsByStoreQuerySchema,
  couponsByStoreSchema,
  createPrizeBodySchema,
  idParamsSchema,
  listPrizeRedemptionsQuerySchema,
  prizeListSchema,
  prizeRedemptionPageSchema,
  prizeSchema,
  ROUTES,
  rankingListSchema,
  redemptionVisitorListSchema,
  redemptionVisitorsQuerySchema,
  sealsReportQuerySchema,
  sealsReportSchema,
  updatePrizeBodySchema,
} from "@arp/contracts";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { Clock } from "../../../shared/application/ports/clock";
import { scopedStoreId } from "../../../shared/application/store-scope";
import { orNotFound } from "../../../shared/domain/errors";
import { staffOf, visitorOf } from "../../../shared/infra/http/auth";
import { createRouter } from "../../../shared/infra/http/router";
import type { OptionalVisitor } from "../../app-api/http/optional-visitor";
import type { CreateCatalogItemUseCase } from "../../directory/application/create-catalog-item.use-case";
import type { DeleteCatalogItemUseCase } from "../../directory/application/delete-catalog-item.use-case";
import type { UpdateCatalogItemUseCase } from "../../directory/application/update-catalog-item.use-case";
import type {
  CancelRedemptionUseCase,
  CounterRedeemPrizeUseCase,
  SetRankingNicknameUseCase,
} from "../application/club.use-cases";
import { PRIZE_NOT_FOUND, type PrizeProps } from "../domain/club";
import type { ClubQueries } from "../infra/club.queries";

const RANKING_PANEL_LIMIT = 100;

export interface ClubRoutesDeps {
  queries: ClubQueries;
  clock: Clock;
  prizes: {
    create: CreateCatalogItemUseCase<PrizeProps>;
    update: UpdateCatalogItemUseCase<PrizeProps>;
    remove: DeleteCatalogItemUseCase<PrizeProps>;
  };
  cancel: CancelRedemptionUseCase;
  counterRedeem: CounterRedeemPrizeUseCase;
}

/** Painel: lojinha, trocas, ranking e selos dados por loja/produto. */
export function clubRoutes(deps: ClubRoutesDeps): FastifyPluginAsyncZod {
  const { queries, clock } = deps;
  const prize = async (id: string) =>
    orNotFound((await queries.prizes(clock.now(), id))[0], PRIZE_NOT_FOUND);

  return async (app) => {
    const r = createRouter(app, { audience: "admin", tag: "Clube ARP" });

    r.route(ROUTES.prizes.list, { response: { 200: prizeListSchema } }, async () => ({
      data: await queries.prizes(clock.now()),
    }));
    r.route(
      ROUTES.prizes.create,
      { body: createPrizeBodySchema, response: { 201: prizeSchema } },
      async (request, reply) => {
        const id = await deps.prizes.create.execute(request.body, staffOf(request));
        return reply.status(201).send(await prize(id));
      },
    );
    r.route(
      ROUTES.prizes.update,
      { params: idParamsSchema, body: updatePrizeBodySchema, response: { 200: prizeSchema } },
      async (request) => {
        await deps.prizes.update.execute(
          { id: request.params.id, changes: request.body },
          staffOf(request),
        );
        return prize(request.params.id);
      },
    );
    r.route(ROUTES.prizes.remove, { params: idParamsSchema }, async (request, reply) => {
      await deps.prizes.remove.execute(request.params, staffOf(request));
      return reply.status(204).send();
    });

    r.route(
      ROUTES.prizeRedemptions.list,
      {
        querystring: listPrizeRedemptionsQuerySchema,
        response: { 200: prizeRedemptionPageSchema },
      },
      async (request) => queries.redemptions(request.query),
    );
    r.route(
      ROUTES.prizeRedemptions.visitors,
      {
        querystring: redemptionVisitorsQuerySchema,
        response: { 200: redemptionVisitorListSchema },
      },
      async (request) => ({
        data: await queries.redemptionVisitors(request.query.q, clock.now()),
      }),
    );
    r.route(
      ROUTES.prizeRedemptions.create,
      { body: counterRedeemBodySchema, response: { 201: counterRedeemResultSchema } },
      async (request, reply) =>
        reply.status(201).send(await deps.counterRedeem.execute(request.body, staffOf(request))),
    );
    r.route(ROUTES.prizeRedemptions.cancel, { params: idParamsSchema }, async (request, reply) => {
      await deps.cancel.execute(request.params, staffOf(request));
      return reply.status(204).send();
    });

    r.route(ROUTES.clubReports.ranking, { response: { 200: rankingListSchema } }, async () => ({
      data: (await queries.ranking(clock.now(), RANKING_PANEL_LIMIT)).top,
    }));
    r.route(
      ROUTES.clubReports.coupons,
      { querystring: couponsByStoreQuerySchema, response: { 200: couponsByStoreSchema } },
      async (request) => ({ data: await queries.couponsByStore(request.query) }),
    );
    r.route(
      ROUTES.clubReports.seals,
      { querystring: sealsReportQuerySchema, response: { 200: sealsReportSchema } },
      async (request) => {
        // Lojista vê só a própria loja.
        const storeId = scopedStoreId(staffOf(request), request.query.storeId);
        return { data: await queries.sealsReport({ ...request.query, storeId }) };
      },
    );
  };
}

const { APP_ROUTES } = App;

export interface AppClubRoutesDeps {
  queries: ClubQueries;
  clock: Clock;
  optionalVisitor: OptionalVisitor;
  setNickname: SetRankingNicknameUseCase;
}

/** App: Clube ARP (registrado sob /app). */
export function appClubRoutes(deps: AppClubRoutesDeps): FastifyPluginAsyncZod {
  const { queries, clock } = deps;
  return async (app) => {
    const r = createRouter(app, { audience: "app", tag: "App: Clube ARP" });

    r.route(APP_ROUTES.club.get, { response: { 200: App.clubSchema } }, async (request) =>
      queries.club(await deps.optionalVisitor(request), clock.now()),
    );
    r.route(
      APP_ROUTES.club.joinRanking,
      { body: App.joinRankingBodySchema },
      async (request, reply) => {
        await deps.setNickname.execute({ nickname: request.body.nickname }, visitorOf(request));
        return reply.status(204).send();
      },
    );
    r.route(APP_ROUTES.club.leaveRanking, {}, async (request, reply) => {
      await deps.setNickname.execute({ nickname: null }, visitorOf(request));
      return reply.status(204).send();
    });
  };
}

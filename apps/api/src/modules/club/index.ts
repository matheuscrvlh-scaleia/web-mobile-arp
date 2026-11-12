import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { CoreDeps } from "../../shared/infra/core";
import { createOptionalVisitor } from "../app-api/http/optional-visitor";
import { CreateCatalogItemUseCase } from "../directory/application/create-catalog-item.use-case";
import { DeleteCatalogItemUseCase } from "../directory/application/delete-catalog-item.use-case";
import { UpdateCatalogItemUseCase } from "../directory/application/update-catalog-item.use-case";
import {
  CancelMyRedemptionUseCase,
  CancelRedemptionUseCase,
  CounterRedeemPrizeUseCase,
  DeliverRedemptionUseCase,
  RedeemPrizeUseCase,
  SetRankingNicknameUseCase,
} from "./application/club.use-cases";
import { PRIZE_NOT_FOUND } from "./domain/club";
import { appClubRoutes, clubRoutes } from "./http/club.routes";
import { ClubQueries } from "./infra/club.queries";
import { PgClubStore, prizeRepository } from "./infra/pg-club-store";
import { pendingRedemptionsJob, pointsExpiryJob } from "./infra/points-expiry-job";

/** Clube ARP (Fase 2): lojinha, trocas, ranking e relatório de selos. */
export function createClubModule(
  core: CoreDeps,
  deps: { isVisitorActive: (visitorId: string) => Promise<boolean> },
) {
  const { db, uow, audit, clock, random, tokens } = core;
  const queries = new ClubQueries(db);
  const store = new PgClubStore(db);
  const clubDeps = { store, random, clock, audit, uow };
  const prizeDeps = {
    entityType: "prize",
    notFoundMessage: PRIZE_NOT_FOUND,
    repository: prizeRepository(db),
    audit,
    uow,
  };

  const panel = clubRoutes({
    queries,
    clock,
    prizes: {
      create: new CreateCatalogItemUseCase(prizeDeps),
      update: new UpdateCatalogItemUseCase(prizeDeps),
      remove: new DeleteCatalogItemUseCase(prizeDeps),
    },
    cancel: new CancelRedemptionUseCase(clubDeps),
    counterRedeem: new CounterRedeemPrizeUseCase(clubDeps),
    deliver: new DeliverRedemptionUseCase(clubDeps),
  });
  const app = appClubRoutes({
    queries,
    clock,
    optionalVisitor: createOptionalVisitor(tokens, deps.isVisitorActive),
    setNickname: new SetRankingNicknameUseCase(clubDeps),
    redeem: new RedeemPrizeUseCase(clubDeps),
    cancelMine: new CancelMyRedemptionUseCase(clubDeps),
  });

  const routes: FastifyPluginAsyncZod = async (api) => {
    await api.register(panel);
    await api.register(app, { prefix: "/app" });
  };
  return {
    routes,
    jobs: [
      pointsExpiryJob({ db, push: core.push, clock, logger: core.logger }),
      pendingRedemptionsJob({ store, clock, logger: core.logger }),
    ],
  };
}

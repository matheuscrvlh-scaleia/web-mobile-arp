import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { CoreDeps } from "../../shared/infra/core";
import { AwardCouponChallengesUseCase } from "./application/award-coupon-challenges.use-case";
import { CreateCampaignUseCase } from "./application/create-campaign.use-case";
import { CreateChallengeUseCase } from "./application/create-challenge.use-case";
import { CreateQrCodeUseCase } from "./application/create-qr-code.use-case";
import { CreateSealUseCase } from "./application/create-seal.use-case";
import { DeleteChallengeUseCase } from "./application/delete-challenge.use-case";
import type { GamificationDeps } from "./application/gamification-deps";
import { ReplaceCampaignTiersUseCase } from "./application/replace-campaign-tiers.use-case";
import { ScanQrCodeUseCase } from "./application/scan-qr-code.use-case";
import { UpdateCampaignUseCase } from "./application/update-campaign.use-case";
import { UpdateChallengeUseCase } from "./application/update-challenge.use-case";
import { UpdateQrCodeUseCase } from "./application/update-qr-code.use-case";
import { UpdateSealUseCase } from "./application/update-seal.use-case";
import { gamificationRoutes } from "./http/gamification.routes";
import { GamificationQueries } from "./infra/gamification.queries";
import {
  PgCampaignRepository,
  PgChallengeReferences,
  PgChallengeRepository,
  PgQrCodeRepository,
  PgSealAwardRepository,
  PgSealRepository,
} from "./infra/pg-gamification-repositories";

export type {
  AwardCouponChallengesUseCase,
  CouponSealAward,
} from "./application/award-coupon-challenges.use-case";
export type { ScanQrCodeUseCase } from "./application/scan-qr-code.use-case";

export function createGamificationModule(core: CoreDeps) {
  const { db, uow, clock, random, audit } = core;
  const deps: GamificationDeps = {
    seals: new PgSealRepository(db),
    campaigns: new PgCampaignRepository(db),
    challenges: new PgChallengeRepository(db),
    qrCodes: new PgQrCodeRepository(db),
    awards: new PgSealAwardRepository(db),
    references: new PgChallengeReferences(db),
    random,
    audit,
    clock,
    uow,
  };
  const queries = new GamificationQueries(db, clock);

  const routes: FastifyPluginAsyncZod = gamificationRoutes({
    queries,
    qrCodes: deps.qrCodes,
    clock,
    createSeal: new CreateSealUseCase(deps),
    updateSeal: new UpdateSealUseCase(deps),
    createCampaign: new CreateCampaignUseCase(deps),
    updateCampaign: new UpdateCampaignUseCase(deps),
    replaceTiers: new ReplaceCampaignTiersUseCase(deps),
    createChallenge: new CreateChallengeUseCase(deps),
    updateChallenge: new UpdateChallengeUseCase(deps),
    deleteChallenge: new DeleteChallengeUseCase(deps),
    createQrCode: new CreateQrCodeUseCase(deps),
    updateQrCode: new UpdateQrCodeUseCase(deps),
  });

  return {
    routes,
    scanQrCode: new ScanQrCodeUseCase(deps),
    // Baixa de cupom no caixa (promoções) → selo do desafio automático.
    awardCouponChallenges: new AwardCouponChallengesUseCase(deps),
  };
}

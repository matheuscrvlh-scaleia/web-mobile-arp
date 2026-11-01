import type { AuthUser, CouponClaim } from "@arp/contracts";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { CoreDeps } from "../../shared/infra/core";
import type { SessionService } from "../identity";
import type { LookupClaimUseCase, RedeemClaimUseCase } from "../promotions";
import { GetMerchantOverviewUseCase } from "./application/get-merchant-overview.use-case";
import { LookupMerchantClaimUseCase } from "./application/lookup-merchant-claim.use-case";
import { MerchantLoginUseCase } from "./application/merchant-login.use-case";
import { MerchantLogoutUseCase } from "./application/merchant-logout.use-case";
import { RedeemMerchantClaimUseCase } from "./application/redeem-merchant-claim.use-case";
import { RefreshMerchantSessionUseCase } from "./application/refresh-merchant-session.use-case";
import { merchantRoutes } from "./http/merchant.routes";
import { MerchantQueries } from "./infra/merchant.queries";
import {
  PgMerchantAccountRepository,
  PgMerchantStoreReader,
} from "./infra/pg-merchant-repositories";

export interface MerchantModuleDeps {
  sessions: SessionService;
  authUser(userId: string): Promise<AuthUser | null>;
  lookupClaim: LookupClaimUseCase;
  redeemClaim: RedeemClaimUseCase;
  claimById(id: string): Promise<CouponClaim | null>;
}

/** Até 15 s: a tela fica aberta no caixa e "ao vivo" não pode ficar um minuto atrás. */
const OVERVIEW_CACHE_MAX_MS = 15_000;

/**
 * Painel do lojista dentro do app (/api/v1/app/merchant/*): login de usuário
 * do painel com refresh no corpo, caixa (consultar/usar código) e números da
 * loja. Reusa as sessões do identity e os casos de uso do caixa do promotions.
 */
export function createMerchantModule(core: CoreDeps, deps: MerchantModuleDeps) {
  const { db, uow, clock, hasher, tokens, audit, cache, config } = core;
  const accounts = new PgMerchantAccountRepository(db);
  const stores = new PgMerchantStoreReader(db);
  const { sessions } = deps;
  const claimsDeps = {
    lookup: deps.lookupClaim,
    redeem: deps.redeemClaim,
    claimById: deps.claimById,
    stores,
  };

  const routes: FastifyPluginAsyncZod = async (app) => {
    await app.register(
      merchantRoutes({
        login: new MerchantLoginUseCase({
          accounts,
          stores,
          hasher,
          sessions,
          tokens,
          audit,
          clock,
          uow,
        }),
        refresh: new RefreshMerchantSessionUseCase({ accounts, stores, sessions, tokens }),
        logout: new MerchantLogoutUseCase({ sessions }),
        lookup: new LookupMerchantClaimUseCase(claimsDeps),
        redeem: new RedeemMerchantClaimUseCase({ ...claimsDeps, cache }),
        overview: new GetMerchantOverviewUseCase({
          reader: new MerchantQueries(db),
          stores,
          cache,
          clock,
          cacheTtlMs: Math.min(config.dashboardCacheTtlMs, OVERVIEW_CACHE_MAX_MS),
        }),
        authUser: deps.authUser,
        loginRateLimit: config.loginRateLimit,
      }),
      { prefix: "/app" },
    );
  };

  return { routes };
}

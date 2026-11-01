import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { CoreDeps } from "../../shared/infra/core";
import type { Job } from "../../shared/infra/jobs/scheduler";
import type { ScanQrCodeUseCase } from "../gamification";
import type { SessionService } from "../identity";
import type { ClaimCouponUseCase } from "../promotions";
import { RefreshVisitorSessionUseCase } from "./application/refresh-visitor-session.use-case";
import {
  RegisterPushTokenUseCase,
  RemovePushTokenUseCase,
} from "./application/register-push-token.use-case";
import { RegisterVisitorUseCase } from "./application/register-visitor.use-case";
import { RequestPasswordResetUseCase } from "./application/request-password-reset.use-case";
import { ResetPasswordUseCase } from "./application/reset-password.use-case";
import { SetEventInterestUseCase } from "./application/set-event-interest.use-case";
import { SetStoreFavoriteUseCase } from "./application/set-store-favorite.use-case";
import { SetStoreFollowUseCase } from "./application/set-store-follow.use-case";
import type { SocialIdentityVerifier } from "./application/social-identity";
import { SocialLoginUseCase } from "./application/social-login.use-case";
import { TrackHighlightUseCase } from "./application/track-highlight.use-case";
import { UpdateMyProfileUseCase } from "./application/update-my-profile.use-case";
import { VisitorLoginUseCase } from "./application/visitor-login.use-case";
import { VisitorLogoutUseCase } from "./application/visitor-logout.use-case";
import { appAuthRoutes } from "./http/app-auth.routes";
import { appBrowseRoutes } from "./http/app-browse.routes";
import { appEngagementRoutes } from "./http/app-engagement.routes";
import { createOptionalVisitor } from "./http/optional-visitor";
import { AppReads } from "./infra/app-reads";
import { BufferedHighlightMetrics } from "./infra/buffered-highlight-metrics";
import { CatalogQueries } from "./infra/catalog.queries";
import { FeedQueries } from "./infra/feed.queries";
import { HmacResetCodeHasher } from "./infra/hmac-reset-code-hasher";
import { PgEngagementRepository, PgVisitorAccountRepository } from "./infra/pg-app-repositories";
import {
  PgPasswordResetRepository,
  PgVisitorCredentialsRepository,
} from "./infra/pg-credentials-repositories";
import { VisitorQueries } from "./infra/visitor.queries";

export { createSocialIdentityVerifier } from "./infra/jose-social-identity-verifier";

export interface AppApiModuleDeps {
  sessions: SessionService;
  claimCoupon: ClaimCouponUseCase;
  scanQrCode: ScanQrCodeUseCase;
  isVisitorActive(visitorId: string): Promise<boolean>;
  /** Valida os id_tokens do Google/Apple (login social). */
  socialVerifier: SocialIdentityVerifier;
  /** Segredo do HMAC dos códigos e validade em minutos. */
  passwordReset: { secret: string; ttlMinutes: number };
}

/** API do app do visitante (/api/v1/app/*), reusando sessões, cupons e selos dos outros módulos. */
export function createAppApiModule(core: CoreDeps, deps: AppApiModuleDeps) {
  const { db, uow, clock, hasher, tokens, audit, config, cache, logger, random, mailer } = core;
  const { sessions } = deps;
  const accounts = new PgVisitorAccountRepository(db);
  const engagement = new PgEngagementRepository(db);
  const catalog = new CatalogQueries(db);
  const feed = new FeedQueries(db);
  const visitors = new VisitorQueries(db);
  const reads = new AppReads({ catalog, feed, visitors, cache, ttlMs: config.appCacheTtlMs });
  const highlightMetrics = new BufferedHighlightMetrics(db, {
    intervalMs: config.highlightMetricsFlushMs,
    logger,
  });
  const authDeps = { visitors: accounts, hasher, sessions, tokens, audit, clock, uow };
  const credentials = new PgVisitorCredentialsRepository(db);
  const resets = new PgPasswordResetRepository(db);
  const resetCodes = new HmacResetCodeHasher(deps.passwordReset.secret);

  const routes: FastifyPluginAsyncZod = async (app) => {
    await app.register(
      async (scope) => {
        await scope.register(
          appAuthRoutes({
            register: new RegisterVisitorUseCase(authDeps),
            login: new VisitorLoginUseCase(authDeps),
            socialLogin: new SocialLoginUseCase({
              ...authDeps,
              verifier: deps.socialVerifier,
              credentials,
            }),
            forgotPassword: new RequestPasswordResetUseCase({
              visitors: accounts,
              resets,
              codes: resetCodes,
              random,
              mailer,
              clock,
              uow,
              ttlMinutes: deps.passwordReset.ttlMinutes,
              logger,
            }),
            resetPassword: new ResetPasswordUseCase({
              ...authDeps,
              credentials,
              resets,
              codes: resetCodes,
            }),
            refresh: new RefreshVisitorSessionUseCase({
              visitors: accounts,
              sessions,
              tokens,
              clock,
            }),
            logout: new VisitorLogoutUseCase({ sessions, engagement }),
            updateProfile: new UpdateMyProfileUseCase({ visitors: accounts, audit, uow }),
            visitors,
            clock,
            authRateLimit: config.loginRateLimit,
          }),
        );
        await scope.register(
          appBrowseRoutes({
            reads,
            feed,
            visitors,
            claimCoupon: deps.claimCoupon,
            scanQrCode: deps.scanQrCode,
            optionalVisitor: createOptionalVisitor(tokens, deps.isVisitorActive),
            clock,
            publicMaxAgeSeconds: Math.floor(config.appCacheTtlMs / 1000),
            actionRateLimit: config.actionRateLimit,
          }),
        );
        await scope.register(
          appEngagementRoutes({
            setFavorite: new SetStoreFavoriteUseCase({ engagement }),
            setFollow: new SetStoreFollowUseCase({ engagement }),
            setInterest: new SetEventInterestUseCase({ engagement }),
            registerPushToken: new RegisterPushTokenUseCase({ engagement, clock }),
            removePushToken: new RemovePushTokenUseCase({ engagement }),
            trackHighlight: new TrackHighlightUseCase({
              highlights: reads,
              metrics: highlightMetrics,
              clock,
            }),
            reads,
            catalog,
            visitors,
            clock,
          }),
        );
      },
      { prefix: "/app" },
    );
  };

  // Códigos de nova senha vencidos há mais de um dia não servem para nada: saem do banco.
  const cleanupJob: Job = {
    name: "delete-expired-password-resets",
    intervalMs: 60 * 60_000,
    async run() {
      const before = new Date(clock.now().getTime() - 86_400_000);
      let deleted = 0;
      for (;;) {
        const batch = await resets.deleteStale(before, 1_000);
        deleted += batch;
        if (batch < 1_000) break;
      }
      if (deleted > 0) logger.info({ deleted }, "Códigos de nova senha vencidos apagados");
    },
  };

  return {
    routes,
    jobs: [cleanupJob],
    /** Liga o timer de gravação das métricas (o servidor chama na subida). */
    start: () => highlightMetrics.start(),
    /** Grava o que ficou acumulado (encerramento). */
    stop: () => highlightMetrics.stop(),
  };
}

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { Env } from "./config/env";
import { createAgendaModule } from "./modules/agenda";
import { createAppApiModule, createSocialIdentityVerifier } from "./modules/app-api";
import { createClubModule } from "./modules/club";
import { createContentModule } from "./modules/content";
import { createDashboardModule } from "./modules/dashboard";
import { createDirectoryModule } from "./modules/directory";
import { createGamificationModule } from "./modules/gamification";
import { createIdentityModule } from "./modules/identity";
import { createMarketingModule } from "./modules/marketing";
import { createMerchantModule } from "./modules/merchant";
import { createPlatformModule } from "./modules/platform";
import { createPromotionsModule } from "./modules/promotions";
import { createVisitorsModule } from "./modules/visitors";
import { type Cache, VISITOR_STATUS_CACHE_PREFIX } from "./shared/application/ports/cache";
import { PgAuditLogger } from "./shared/infra/audit/pg-audit-logger";
import { type CacheStats, MemoryCache } from "./shared/infra/cache/memory-cache";
import { PgNotifyCache } from "./shared/infra/cache/pg-notify-cache";
import type { AppConfig, CoreDeps } from "./shared/infra/core";
import { Database, type DatabaseLogger } from "./shared/infra/database/database";
import { sql } from "./shared/infra/database/sql";
import { deleteExpiredRateLimits } from "./shared/infra/http/rate-limit";
import type { Job } from "./shared/infra/jobs/scheduler";
import { createMailer } from "./shared/infra/mail";
import { DatabaseUnitOfWork, LogPushSender, SystemClock } from "./shared/infra/misc";
import { requestLogContext } from "./shared/infra/request-context";
import { Argon2PasswordHasher } from "./shared/infra/security/argon2-password-hasher";
import { CryptoSecureRandom, Sha256OpaqueTokenGenerator } from "./shared/infra/security/crypto";
import { JoseTokenService } from "./shared/infra/security/jose-token-service";
import { createStorage, LocalDiskStorage } from "./shared/infra/storage";

export interface ModuleRoutes {
  name: string;
  routes: FastifyPluginAsyncZod;
}

export interface Container {
  core: CoreDeps;
  modules: ModuleRoutes[];
  jobs: Job[];
  isVisitorActive(visitorId: string): Promise<boolean>;
  /** Driver local: pasta e prefixo servidos em /uploads. */
  localUploads: { rootDir: string; publicPath: string } | null;
  /** Números do cache em memória (métricas). */
  cacheStats?: () => CacheStats;
  /** Liga o que roda em segundo plano por réplica (escuta de invalidação, gravação de métricas). */
  start(): Promise<void>;
  /** Grava pendências e fecha conexões (graceful shutdown). Idempotente. */
  close(): Promise<void>;
}

/**
 * Logger que começa no console e passa a usar o do Fastify quando ele existe
 * (o banco é criado antes do servidor).
 */
export class DeferredLogger implements DatabaseLogger {
  private target: DatabaseLogger = {
    info: (obj, msg) => console.log(msg ?? "", obj),
    warn: (obj, msg) => console.warn(msg ?? "", obj),
    error: (obj, msg) => console.error(msg ?? "", obj),
  };

  use(target: DatabaseLogger): void {
    this.target = target;
  }
  info(obj: object, msg?: string): void {
    this.target.info(obj, msg);
  }
  warn(obj: object, msg?: string): void {
    this.target.warn(obj, msg);
  }
  error(obj: object, msg?: string): void {
    this.target.error(obj, msg);
  }
}

export function appConfigFrom(env: Env, version: string): AppConfig {
  return {
    nodeEnv: env.NODE_ENV,
    version,
    cookieSecure: env.COOKIE_SECURE,
    refreshTtlDays: { admin: env.REFRESH_TOKEN_TTL_DAYS, app: env.APP_REFRESH_TOKEN_TTL_DAYS },
    refreshReuseGraceMs: env.REFRESH_REUSE_GRACE_SECONDS * 1000,
    uploadMaxBytes: env.UPLOAD_MAX_BYTES,
    loginRateLimit: {
      max: env.LOGIN_RATE_LIMIT_MAX,
      timeWindow: env.LOGIN_RATE_LIMIT_WINDOW,
      distributed: env.RATE_LIMIT_STORE === "postgres",
    },
    actionRateLimit: {
      max: env.ACTION_RATE_LIMIT_MAX,
      timeWindow: env.ACTION_RATE_LIMIT_WINDOW,
      distributed: env.RATE_LIMIT_STORE === "postgres",
    },
    dashboardCacheTtlMs: env.DASHBOARD_CACHE_TTL_SECONDS * 1000,
    appCacheTtlMs: env.APP_CACHE_TTL_SECONDS * 1000,
    highlightMetricsFlushMs: env.HIGHLIGHT_METRICS_FLUSH_MS,
  };
}

export interface ContainerOptions {
  env: Env;
  version: string;
  logger: DatabaseLogger;
}

/** Composition root: instancia adaptadores e módulos com injeção manual. */
export async function createContainer(options: ContainerOptions): Promise<Container> {
  const { env, logger } = options;
  const db = new Database({
    connectionString: env.DATABASE_URL,
    poolMax: env.DB_POOL_MAX,
    ssl: env.DB_SSL,
    ...(env.DB_SSL_CA ? { sslCa: env.DB_SSL_CA } : {}),
    statementTimeoutMs: env.DB_STATEMENT_TIMEOUT_MS,
    lockTimeoutMs: env.DB_LOCK_TIMEOUT_MS,
    idleInTransactionTimeoutMs: env.DB_IDLE_IN_TRANSACTION_TIMEOUT_MS,
    connectionTimeoutMs: env.DB_CONNECTION_TIMEOUT_MS,
    idleTimeoutMs: env.DB_IDLE_TIMEOUT_MS,
    maxLifetimeSeconds: env.DB_MAX_LIFETIME_SECONDS,
    slowQueryMs: env.DB_SLOW_QUERY_MS,
    logger,
    logContext: requestLogContext,
  });
  const memoryCache = new MemoryCache(env.CACHE_MAX_ENTRIES);
  const notifyCache =
    env.CACHE_INVALIDATION === "postgres"
      ? new PgNotifyCache(memoryCache, db, {
          connectionString: env.DATABASE_URL,
          ssl: env.DB_SSL,
          ...(env.DB_SSL_CA ? { sslCa: env.DB_SSL_CA } : {}),
          logger,
        })
      : null;
  const cache: Cache = notifyCache ?? memoryCache;
  const storage = await createStorage(env);

  const core: CoreDeps = {
    config: appConfigFrom(env, options.version),
    db,
    uow: new DatabaseUnitOfWork(db),
    clock: new SystemClock(),
    hasher: new Argon2PasswordHasher(),
    tokens: new JoseTokenService({
      secret: env.JWT_ACCESS_SECRET,
      issuer: env.JWT_ISSUER,
      accessTtlSeconds: env.ACCESS_TOKEN_TTL_SECONDS,
    }),
    opaqueTokens: new Sha256OpaqueTokenGenerator(),
    random: new CryptoSecureRandom(),
    audit: new PgAuditLogger(db),
    cache,
    storage,
    push: new LogPushSender(logger),
    mailer: createMailer(env, logger),
    logger,
  };

  // Visitante bloqueado perde o acesso mesmo com access token ainda válido. A
  // checagem roda em toda requisição autenticada do app: fica em cache curto
  // e o bloqueio pelo painel invalida o prefixo (rotas de visitantes).
  const visitorStatusTtlMs = Math.min(env.APP_CACHE_TTL_SECONDS, 15) * 1000;
  const loadVisitorActive = (visitorId: string) =>
    db.exists(sql`select 1 from visitors.visitors where id = ${visitorId} and status = 'active'`);
  const isVisitorActive = (visitorId: string) =>
    visitorStatusTtlMs > 0
      ? cache.getOrLoad(`${VISITOR_STATUS_CACHE_PREFIX}${visitorId}`, visitorStatusTtlMs, () =>
          loadVisitorActive(visitorId),
        )
      : loadVisitorActive(visitorId);

  const identity = createIdentityModule(core);
  const promotions = createPromotionsModule(core);
  const gamification = createGamificationModule(core);
  const marketing = createMarketingModule(core);
  const appApi = createAppApiModule(core, {
    sessions: identity.sessions,
    claimCoupon: promotions.claimCoupon,
    scanQrCode: gamification.scanQrCode,
    isVisitorActive,
    // Provedor sem client id não quebra a subida: a rota responde 503.
    socialVerifier: createSocialIdentityVerifier(
      { google: env.GOOGLE_CLIENT_IDS, apple: env.APPLE_CLIENT_IDS },
      logger,
    ),
    passwordReset: {
      secret: env.PASSWORD_RESET_SECRET ?? env.JWT_ACCESS_SECRET,
      ttlMinutes: env.PASSWORD_RESET_CODE_TTL_MINUTES,
    },
  });

  const modules: ModuleRoutes[] = [
    { name: "identity", routes: identity.routes },
    { name: "directory", routes: createDirectoryModule(core).routes },
    { name: "promotions", routes: promotions.routes },
    { name: "gamification", routes: gamification.routes },
    { name: "agenda", routes: createAgendaModule(core).routes },
    { name: "marketing", routes: marketing.routes },
    {
      name: "visitors",
      routes: createVisitorsModule(core, { sessions: identity.sessions }).routes,
    },
    { name: "dashboard", routes: createDashboardModule(core).routes },
    { name: "platform", routes: createPlatformModule(core).routes },
    { name: "content", routes: createContentModule(core).routes },
    { name: "club", routes: createClubModule(core, { isVisitorActive }).routes },
    { name: "app-api", routes: appApi.routes },
    {
      name: "merchant",
      routes: createMerchantModule(core, {
        sessions: identity.sessions,
        authUser: identity.authUser,
        lookupClaim: promotions.lookupClaim,
        redeemClaim: promotions.redeemClaim,
        claimById: promotions.claimById,
      }).routes,
    },
  ];
  const jobs: Job[] = [...promotions.jobs, ...marketing.jobs, ...identity.jobs, ...appApi.jobs];
  if (env.RATE_LIMIT_STORE === "postgres") {
    jobs.push({
      name: "delete-expired-rate-limits",
      intervalMs: 5 * 60_000,
      run: async () => {
        await deleteExpiredRateLimits(db);
      },
    });
  }
  let closed = false;

  return {
    core,
    modules,
    jobs,
    isVisitorActive,
    localUploads:
      storage instanceof LocalDiskStorage
        ? { rootDir: storage.directory, publicPath: env.STORAGE_LOCAL_PUBLIC_PATH }
        : null,
    cacheStats: () => memoryCache.stats(),
    async start() {
      appApi.start();
      await notifyCache?.start();
    },
    async close() {
      if (closed) return;
      closed = true;
      // Métricas acumuladas vão para o banco antes de fechar o pool.
      await appApi.stop().catch((err: unknown) => {
        logger.error({ err }, "Falha ao gravar métricas pendentes");
      });
      await notifyCache?.close();
      await db.close();
    },
  };
}

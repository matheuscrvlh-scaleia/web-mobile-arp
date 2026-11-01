import type { AuditLogger } from "../application/ports/audit-logger";
import type { Cache } from "../application/ports/cache";
import type { Clock } from "../application/ports/clock";
import type { Mailer } from "../application/ports/mailer";
import type { PasswordHasher } from "../application/ports/password-hasher";
import type { PushSender } from "../application/ports/push-sender";
import type { SecureRandom } from "../application/ports/secure-random";
import type { Storage } from "../application/ports/storage";
import type { OpaqueTokenGenerator, TokenService } from "../application/ports/token-service";
import type { UnitOfWork } from "../application/ports/unit-of-work";
import type { Database, DatabaseLogger } from "./database/database";

/** Configuração que os módulos precisam (derivada do env no composition root). */
export interface AppConfig {
  nodeEnv: "development" | "test" | "production";
  version: string;
  cookieSecure: boolean;
  refreshTtlDays: { admin: number; app: number };
  /** Ver REFRESH_REUSE_GRACE_SECONDS. */
  refreshReuseGraceMs: number;
  uploadMaxBytes: number;
  /** distributed = conta no Postgres (RATE_LIMIT_STORE=postgres). */
  loginRateLimit: { max: number; timeWindow: string; distributed: boolean };
  /** Pegar cupom / ler QR, por visitante. */
  actionRateLimit: { max: number; timeWindow: string; distributed: boolean };
  dashboardCacheTtlMs: number;
  /** Leituras compartilhadas do app (0 = sem cache). */
  appCacheTtlMs: number;
  /** Intervalo de gravação das métricas de destaque acumuladas. */
  highlightMetricsFlushMs: number;
}

/** Adaptadores compartilhados, montados uma vez no container e injetados nos módulos. */
export interface CoreDeps {
  config: AppConfig;
  db: Database;
  uow: UnitOfWork;
  clock: Clock;
  hasher: PasswordHasher;
  tokens: TokenService;
  opaqueTokens: OpaqueTokenGenerator;
  random: SecureRandom;
  audit: AuditLogger;
  cache: Cache;
  storage: Storage;
  push: PushSender;
  /** null = sem envio de e-mail (produção sem MAIL_DRIVER): quem depende responde 503. */
  mailer: Mailer | null;
  logger: DatabaseLogger;
}

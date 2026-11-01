import { randomUUID } from "node:crypto";
import { API_PREFIX } from "@arp/contracts";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify, { type FastifyServerOptions, LogController } from "fastify";
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { z } from "zod";
import type { Env } from "./config/env";
import type { Container } from "./container";
import { authPlugin } from "./shared/infra/http/auth";
import { errorHandler, notFoundHandler } from "./shared/infra/http/error-handler";
import { registerHttpCache } from "./shared/infra/http/http-cache";
import { HttpMetrics, registerMetrics } from "./shared/infra/http/metrics";
import {
  createRateLimitStore,
  globalRateLimitKey,
  globalRateLimitMax,
} from "./shared/infra/http/rate-limit";
import { healthRoutes, livenessRoute, localUploadsRoutes } from "./shared/infra/http/system.routes";
import type { ZodApp } from "./shared/infra/http/types";
import { runWithRequestContext } from "./shared/infra/request-context";

export interface HttpConfig {
  nodeEnv: "development" | "test" | "production";
  logLevel: string;
  trustProxy: boolean | number | string[];
  corsOrigins: string[];
  /** max = por usuário/visitante autenticado; ipMax = por IP sem token (padrão: max). */
  rateLimit: { max: number; ipMax?: number; timeWindow: string };
  /** Rotas sensíveis contam no Postgres (compartilhado entre réplicas). */
  rateLimitStore?: "memory" | "postgres";
  uploadMaxBytes: number;
  version: string;
  /** Timeouts e limites do servidor HTTP (padrões seguros para atrás de proxy). */
  server?: {
    requestTimeoutMs?: number;
    keepAliveTimeoutMs?: number;
    bodyLimitBytes?: number;
    compression?: boolean;
  };
  metrics?: { enabled: boolean; token?: string };
  /** Encerramento em andamento (readiness passa a 503). */
  isDraining?: () => boolean;
}

/** Configuração HTTP a partir do env validado (main e testes montam igual). */
export function httpConfigFrom(env: Env, version: string): HttpConfig {
  return {
    nodeEnv: env.NODE_ENV,
    logLevel: env.LOG_LEVEL,
    trustProxy: env.TRUST_PROXY,
    corsOrigins: env.CORS_ORIGINS,
    rateLimit: {
      max: env.RATE_LIMIT_MAX,
      ipMax: env.RATE_LIMIT_IP_MAX,
      timeWindow: env.RATE_LIMIT_WINDOW,
    },
    rateLimitStore: env.RATE_LIMIT_STORE,
    uploadMaxBytes: env.UPLOAD_MAX_BYTES,
    version,
    server: {
      requestTimeoutMs: env.HTTP_REQUEST_TIMEOUT_MS,
      keepAliveTimeoutMs: env.HTTP_KEEP_ALIVE_TIMEOUT_MS,
      bodyLimitBytes: env.HTTP_BODY_LIMIT_BYTES,
      compression: env.HTTP_COMPRESSION,
    },
    metrics: {
      enabled: env.METRICS_ENABLED,
      ...(env.METRICS_TOKEN ? { token: env.METRICS_TOKEN } : {}),
    },
  };
}

function trustHops(hops: number) {
  return (_address: string, hop: number) => hop < hops;
}

// Mensagens padrão do Zod (as que o contrato não personaliza) em português.
z.config(z.locales.ptBR());

const REQUEST_ID = /^[A-Za-z0-9._-]{8,64}$/;

/** Nada de credencial ou dado pessoal sensível nos logs. */
const REDACT = [
  "req.headers.authorization",
  "req.headers.cookie",
  'req.headers["x-api-key"]',
  'res.headers["set-cookie"]',
  "*.password",
  "*.currentPassword",
  "*.newPassword",
  "*.refreshToken",
  "*.accessToken",
  "*.token",
  "*.passwordHash",
  "*.password_hash",
  "*.payload",
];

function loggerOptions(config: HttpConfig): FastifyServerOptions["logger"] {
  if (config.nodeEnv === "test" || config.logLevel === "silent") return false;
  return {
    level: config.logLevel,
    redact: { paths: REDACT, censor: "[oculto]" },
    ...(config.nodeEnv === "development"
      ? {
          transport: {
            target: "pino-pretty",
            options: { translateTime: "HH:MM:ss", ignore: "pid,hostname" },
          },
        }
      : {}),
  };
}

/** Escrita bem-sucedida (não GET/HEAD) invalida os prefixos declarados pela rota. */
function isSuccessfulWrite(method: string, status: number): boolean {
  return method !== "GET" && method !== "HEAD" && status >= 200 && status < 400;
}

/**
 * Monta o servidor (sem escutar porta): plugins de segurança, contrato
 * (Zod), autenticação, rotas dos módulos e tratamento de erros. Testável
 * com app.inject().
 */
export async function buildApp(config: HttpConfig, container: Container): Promise<ZodApp> {
  const server = config.server ?? {};
  const requestTimeout = server.requestTimeoutMs ?? 60_000;
  const app = Fastify({
    logger: loggerOptions(config),
    // Número = saltos confiáveis (o tipo do Fastify só aceita função para isso).
    trustProxy:
      typeof config.trustProxy === "number" ? trustHops(config.trustProxy) : config.trustProxy,
    bodyLimit: server.bodyLimitBytes ?? 1024 * 1024,
    // Requisição inteira (inclui upload) tem prazo; conexão ociosa do proxy
    // dura mais que o keepalive dele (senão o proxy reusa socket já fechado → 502).
    requestTimeout,
    keepAliveTimeout: server.keepAliveTimeoutMs ?? 72_000,
    // No close(): 503 + Connection: close para quem chegar e fecha keep-alive ocioso.
    return503OnClosing: true,
    forceCloseConnections: "idle",
    requestIdHeader: false,
    logController: new LogController({ requestIdLogLabel: "requestId" }),
    genReqId: (req) => {
      const incoming = req.headers["x-request-id"];
      return typeof incoming === "string" && REQUEST_ID.test(incoming) ? incoming : randomUUID();
    },
    routerOptions: { ignoreTrailingSlash: true, maxParamLength: 200 },
  }).withTypeProvider<ZodTypeProvider>();
  // headersTimeout não pode passar do requestTimeout (Node valida).
  app.server.headersTimeout = Math.min(60_000, requestTimeout);

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler(notFoundHandler);
  app.addHook("onRequest", async (request, reply) => {
    reply.header("x-request-id", request.id);
  });
  // Depois do parse do corpo: o handler (e o banco, nos logs de consulta lenta)
  // enxerga o requestId pelo AsyncLocalStorage.
  app.addHook("preHandler", (request, _reply, done) => {
    runWithRequestContext({ requestId: request.id }, done);
  });
  // Escrita deu certo (transação já confirmada no handler): invalida antes de
  // responder, então a próxima leitura de quem escreveu já vem atualizada.
  app.addHook("onSend", async (request, reply, payload) => {
    const prefixes = request.routeOptions.config?.invalidates;
    if (prefixes && isSuccessfulWrite(request.method, reply.statusCode)) {
      for (const prefix of prefixes) container.core.cache.invalidate(prefix);
    }
    return payload;
  });

  const production = config.nodeEnv === "production";
  await app.register(helmet, {
    // API só devolve JSON e imagens; em dev o /docs precisa de scripts inline.
    contentSecurityPolicy: production
      ? { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } }
      : false,
    // Imagens de /uploads são exibidas pelo web em outra origem (dev).
    crossOriginResourcePolicy: { policy: "cross-origin" },
  });
  await app.register(cors, {
    origin: config.corsOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["authorization", "content-type", "x-request-id", "if-none-match"],
    exposedHeaders: ["x-request-id", "retry-after", "etag"],
    maxAge: 600,
  });
  await app.register(cookie);
  await app.register(multipart, {
    limits: { fileSize: config.uploadMaxBytes, files: 1, fields: 5, parts: 6 },
  });
  await app.register(rateLimit, {
    max: globalRateLimitMax(config.rateLimit.max, config.rateLimit.ipMax ?? config.rateLimit.max),
    timeWindow: config.rateLimit.timeWindow,
    keyGenerator: globalRateLimitKey(container.core.tokens),
    store: createRateLimitStore({
      db: config.rateLimitStore === "postgres" ? container.core.db : null,
      logger: container.core.logger,
    }),
  });
  registerHttpCache(app, { compression: server.compression ?? true });

  if (config.metrics?.enabled) {
    const metrics = new HttpMetrics({
      pool: () => container.core.db.stats(),
      ...(container.cacheStats ? { cache: container.cacheStats } : {}),
    });
    registerMetrics(app, metrics, config.metrics.token ? { token: config.metrics.token } : {});
  }

  if (!production) {
    await app.register(swagger, {
      openapi: {
        openapi: "3.1.0",
        info: { title: "API ARP", version: config.version },
        components: {
          securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
        },
      },
      transform: jsonSchemaTransform,
    });
    await app.register(swaggerUi, { routePrefix: "/docs" });
  }

  await app.register(authPlugin, {
    tokens: container.core.tokens,
    isVisitorActive: container.isVisitorActive,
  });

  const startedAt = Date.now();
  await app.register(livenessRoute({ version: config.version, startedAt }));
  await app.register(
    async (api) => {
      await api.register(
        healthRoutes({
          version: config.version,
          startedAt,
          checks: { database: () => container.core.db.ping() },
          ...(config.isDraining ? { isDraining: config.isDraining } : {}),
        }),
      );
      for (const module of container.modules) await api.register(module.routes);
    },
    { prefix: API_PREFIX },
  );

  if (container.localUploads) await app.register(localUploadsRoutes(container.localUploads));

  return app;
}

import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { healthSchema, ROUTES } from "@arp/contracts";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { assertValidStorageKey } from "../../application/ports/storage";
import { NotFoundError } from "../../domain/errors";
import { createRouter } from "./router";

export interface HealthDeps {
  version: string;
  startedAt: number;
  checks: Record<string, () => Promise<boolean>>;
  /** true depois do SIGTERM: a réplica sai do balanceador antes de fechar. */
  isDraining?: () => boolean;
}

/**
 * Readiness — GET /api/v1/health: 200 quando tudo responde, 503 "degraded"
 * quando algo caiu ou a réplica está encerrando (checks.server = down).
 * Balanceador/orquestrador tira a réplica de rotação, mas não a reinicia.
 */
export function healthRoutes(deps: HealthDeps): FastifyPluginAsyncZod {
  return async (app) => {
    const r = createRouter(app, { audience: "admin", tag: "Plataforma" });
    r.route(
      ROUTES.health,
      { response: { 200: healthSchema, 503: healthSchema } },
      async (_request, reply) => {
        reply.header("cache-control", "no-store");
        const draining = deps.isDraining?.() ?? false;
        const entries = await Promise.all(
          Object.entries(deps.checks).map(async ([name, check]) => {
            const up = !draining && (await check().catch(() => false));
            return [name, up ? "up" : "down"] as const;
          }),
        );
        if (draining) entries.push(["server", "down"] as const);
        const checks = Object.fromEntries(entries);
        const ok = entries.every(([, s]) => s === "up");
        return reply.status(ok ? 200 : 503).send({
          status: ok ? "ok" : "degraded",
          version: deps.version,
          uptime: Math.round((Date.now() - deps.startedAt) / 1000),
          checks,
        });
      },
      { rateLimit: false },
    );
  };
}

/**
 * Liveness — GET /health/live: só diz que o processo responde (sem banco).
 * Banco fora do ar NÃO deve reiniciar as réplicas (todas reiniciariam juntas).
 */
export function livenessRoute(deps: { version: string; startedAt: number }) {
  return async (app: import("fastify").FastifyInstance) => {
    app.get(
      "/health/live",
      { schema: { hide: true }, config: { rateLimit: false } },
      async (_request, reply) =>
        reply.header("cache-control", "no-store").send({
          status: "ok",
          version: deps.version,
          uptime: Math.round((Date.now() - deps.startedAt) / 1000),
        }),
    );
  };
}

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

/**
 * Arquivos do storage (disco do servidor) em /uploads/*. Só imagens, só
 * dentro da pasta raiz.
 */
export function localUploadsRoutes(options: { rootDir: string; publicPath: string }) {
  const root = path.resolve(options.rootDir);
  return async (app: import("fastify").FastifyInstance) => {
    app.get(`${options.publicPath}/*`, { schema: { hide: true } }, async (request, reply) => {
      const key = (request.params as { "*": string })["*"];
      try {
        assertValidStorageKey(key);
      } catch {
        throw new NotFoundError("Arquivo não encontrado");
      }
      const file = path.resolve(root, ...key.split("/"));
      const type = CONTENT_TYPES[path.extname(file).toLowerCase()];
      if (!file.startsWith(root + path.sep) || !type)
        throw new NotFoundError("Arquivo não encontrado");
      const info = await stat(file).catch(() => null);
      if (!info?.isFile()) throw new NotFoundError("Arquivo não encontrado");
      return reply
        .header("content-type", type)
        .header("content-length", info.size)
        .header("cache-control", "public, max-age=31536000, immutable")
        .send(createReadStream(file));
    });
  };
}

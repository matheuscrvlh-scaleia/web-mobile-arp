import { App } from "@arp/contracts";
import type { FastifyRateLimitStoreCtor } from "@fastify/rate-limit";
import type { FastifyRequest } from "fastify";
import type { TokenService } from "../../application/ports/token-service";
import type { Database, DatabaseLogger } from "../database/database";
import { sql } from "../database/sql";
import { tryVerifyBearer } from "./bearer";

/*
 * Rate limit em duas camadas:
 * - global (toda rota): em memória por réplica. Chave = id do usuário/visitante
 *   quando há token válido (RATE_LIMIT_MAX), senão o IP (RATE_LIMIT_IP_MAX,
 *   mais alto: no wi-fi do complexo muitos visitantes dividem um IP).
 * - rotas sensíveis (login, cadastro, pegar cupom, ler QR): limite próprio e,
 *   com RATE_LIMIT_STORE=postgres, contagem compartilhada entre réplicas numa
 *   tabela UNLOGGED (um upsert por requisição só nessas rotas).
 */

interface Counter {
  current: number;
  ttl: number;
}
type Callback = (err: Error | null, result?: Counter) => void;

/** Parâmetros que o @fastify/rate-limit passa ao store (global ou da rota). */
interface StoreParams {
  /** Rota com contagem compartilhada (config.rateLimit.distributed). */
  distributed?: boolean;
  routeInfo?: { method?: string | string[]; url?: string };
}

export interface RateLimitStore {
  incr(key: string, cb: Callback, timeWindow: number, max: number): void;
  child(params: object): RateLimitStore;
}

/** Janela fixa em memória com teto de chaves (as mais antigas saem primeiro). */
export class MemoryRateLimitStore implements RateLimitStore {
  private readonly windows = new Map<string, { hits: number; resetAt: number }>();

  constructor(
    private readonly maxKeys = 20_000,
    private readonly now: () => number = Date.now,
  ) {}

  incr(key: string, cb: Callback, timeWindow: number): void {
    const now = this.now();
    let window = this.windows.get(key);
    if (!window || window.resetAt <= now) {
      this.windows.delete(key);
      window = { hits: 0, resetAt: now + timeWindow };
      this.windows.set(key, window);
      while (this.windows.size > this.maxKeys) {
        const oldest = this.windows.keys().next().value;
        if (oldest === undefined) break;
        this.windows.delete(oldest);
      }
    }
    window.hits++;
    cb(null, { current: window.hits, ttl: window.resetAt - now });
  }

  child(): RateLimitStore {
    return new MemoryRateLimitStore(this.maxKeys, this.now);
  }
}

/**
 * Contagem no Postgres (tabela platform.rate_limit_hits, UNLOGGED). Se o banco
 * falhar, conta em memória nesta réplica (não derruba a rota por causa do limite).
 */
export class PgRateLimitStore implements RateLimitStore {
  private readonly fallback = new MemoryRateLimitStore();

  constructor(
    private readonly db: Database,
    private readonly namespace: string,
    private readonly logger?: DatabaseLogger,
  ) {}

  incr(key: string, cb: Callback, timeWindow: number): void {
    const fullKey = `${this.namespace}|${key}`;
    this.db
      .one<{ hits: number; ttl_ms: number }>(sql`
        insert into platform.rate_limit_hits as r (key, hits, reset_at)
        values (${fullKey}, 1, clock_timestamp() + make_interval(secs => ${timeWindow / 1000}))
        on conflict (key) do update set
          hits = case when r.reset_at <= clock_timestamp() then 1 else r.hits + 1 end,
          reset_at = case when r.reset_at <= clock_timestamp() then excluded.reset_at else r.reset_at end
        returning hits, greatest(0, extract(epoch from reset_at - clock_timestamp()) * 1000)::int as ttl_ms
      `)
      .then((row) => cb(null, { current: row.hits, ttl: row.ttl_ms }))
      .catch((err: unknown) => {
        this.logger?.warn({ err }, "Rate limit no Postgres falhou; contando em memória");
        this.fallback.incr(fullKey, cb, timeWindow);
      });
  }

  child(): RateLimitStore {
    return this;
  }
}

/**
 * Store passado ao @fastify/rate-limit: memória por padrão; rotas com
 * `distributed: true` usam o Postgres quando configurado.
 */
export function createRateLimitStore(options: {
  db: Database | null;
  logger?: DatabaseLogger;
}): FastifyRateLimitStoreCtor {
  const { db, logger } = options;
  class HybridRateLimitStore implements RateLimitStore {
    private readonly memory = new MemoryRateLimitStore();

    incr(key: string, cb: Callback, timeWindow: number): void {
      this.memory.incr(key, cb, timeWindow);
    }

    child(routeParams: object): RateLimitStore {
      const params = routeParams as StoreParams;
      if (params.distributed && db) {
        const method = [params.routeInfo?.method ?? ""].flat().join(",");
        return new PgRateLimitStore(db, `${method} ${params.routeInfo?.url ?? ""}`, logger);
      }
      return new MemoryRateLimitStore();
    }
  }
  return HybridRateLimitStore as unknown as FastifyRateLimitStoreCtor;
}

/** Chave do limite global: sujeito do token válido ou IP. */
export function globalRateLimitKey(tokens: TokenService) {
  return async (request: FastifyRequest): Promise<string> => {
    const actor = request.actor;
    if (actor) return `${actor.type}:${actor.id}`;
    const audience = request.url.startsWith(App.APP_API_PREFIX) ? "app" : "admin";
    const claims = await tryVerifyBearer(request, tokens, audience);
    return claims ? `${claims.audience}:${claims.subject}` : `ip:${request.ip}`;
  };
}

/** Limite por chave: anônimo (IP) tem teto próprio. */
export function globalRateLimitMax(perSubject: number, perIp: number) {
  return (_request: FastifyRequest, key: string) => (key.startsWith("ip:") ? perIp : perSubject);
}

/** Chave por ator autenticado (visitante ou equipe; cai no IP se não houver ator). */
export function actorRateLimitKey(prefix: string) {
  return (request: FastifyRequest): string =>
    `${prefix}:${request.actor ? `${request.actor.type}:${request.actor.id}` : `ip:${request.ip}`}`;
}

/** Limpa janelas vencidas da tabela (job; só com RATE_LIMIT_STORE=postgres). */
export async function deleteExpiredRateLimits(db: Database, batch = 5_000): Promise<number> {
  let total = 0;
  for (;;) {
    const { rowCount } = await db.query(sql`
      delete from platform.rate_limit_hits
      where key in (
        select key from platform.rate_limit_hits
        where reset_at < now() - interval '1 minute'
        limit ${batch}
      )
    `);
    total += rowCount;
    if (rowCount < batch) return total;
  }
}

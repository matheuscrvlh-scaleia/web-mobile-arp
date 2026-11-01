import type { Permission } from "@arp/contracts";
import type {
  ContextConfigDefault,
  FastifySchema,
  onRequestAsyncHookHandler,
  RawReplyDefaultExpression,
  RawRequestDefaultExpression,
  RawServerDefault,
  RouteGenericInterface,
  RouteHandlerMethod,
} from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { z } from "zod";
import type { TokenAudience } from "../../application/ports/token-service";
import type { RouteHttpCache } from "./http-cache";
import type { ZodApp } from "./types";

/** Definição de rota vinda do contrato (ROUTES do painel ou APP_ROUTES do app). */
export interface ContractRoute {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  summary: string;
  permission?: Permission | null;
  public?: true;
}

export interface ZodRouteSchema extends FastifySchema {
  params?: z.ZodType;
  querystring?: z.ZodType;
  body?: z.ZodType;
  response?: Record<number, z.ZodType>;
}

export type ContractHandler<S extends ZodRouteSchema> = RouteHandlerMethod<
  RawServerDefault,
  RawRequestDefaultExpression,
  RawReplyDefaultExpression,
  RouteGenericInterface,
  ContextConfigDefault,
  S,
  ZodTypeProvider
>;

export interface RouteExtras {
  /**
   * Limite próprio da rota (ex.: login) no lugar do global; false = sem limite.
   * `distributed: true` conta no Postgres quando RATE_LIMIT_STORE=postgres.
   */
  rateLimit?: Record<string, unknown> | false;
  bodyLimit?: number;
  /** Cache HTTP da resposta (ex.: público para anônimos nas leituras do app). */
  httpCache?: RouteHttpCache;
  /** Sobrescreve os prefixos invalidados do router (false = esta escrita não invalida nada). */
  invalidates?: readonly string[] | false;
}

declare module "fastify" {
  interface FastifyContextConfig {
    /** Prefixos de cache invalidados quando a escrita (não-GET) dá certo. */
    invalidates?: readonly string[];
  }
}

export interface RouterOptions {
  audience: TokenAudience;
  tag: string;
  /**
   * Prefixos de cache que as escritas destas rotas tornam velhos (ex.:
   * APP_CONTENT_CACHE_PREFIX nos módulos de conteúdo). O app.ts invalida
   * depois da resposta 2xx/3xx de qualquer método que não seja GET/HEAD.
   */
  invalidates?: readonly string[];
}

export interface Router {
  route<S extends ZodRouteSchema>(
    def: ContractRoute,
    schema: S,
    handler: ContractHandler<S>,
    extras?: RouteExtras,
  ): void;
}

function invalidationOf(
  def: ContractRoute,
  options: RouterOptions,
  extras: RouteExtras,
): { invalidates?: readonly string[] } {
  if (def.method === "GET") return {};
  const prefixes = extras.invalidates ?? options.invalidates;
  return prefixes && prefixes.length > 0 ? { invalidates: prefixes } : {};
}

/**
 * Registra rotas a partir do contrato: método, caminho, permissão e resumo
 * vêm de ROUTES/APP_ROUTES, então a API não diverge do que o web/app chamam.
 * Rota não pública ganha (no onRequest) authenticate(audience) e, se tiver permissão,
 * authorize(permission).
 */
export function createRouter(app: ZodApp, options: RouterOptions): Router {
  return {
    route(def, schema, handler, extras = {}) {
      // onRequest: autentica antes de ler/validar o corpo (sem login não há 400 nem parsing).
      const onRequest: onRequestAsyncHookHandler[] = [];
      if (!def.public) {
        onRequest.push(app.auth.authenticate(options.audience));
        if (def.permission) onRequest.push(app.auth.authorize(def.permission));
      }
      app.route({
        method: def.method,
        url: def.path,
        schema: {
          ...schema,
          summary: def.summary,
          tags: [options.tag],
          ...(def.public ? {} : { security: [{ bearerAuth: [] }] }),
        },
        onRequest,
        ...(extras.bodyLimit ? { bodyLimit: extras.bodyLimit } : {}),
        config: {
          ...(extras.rateLimit !== undefined ? { rateLimit: extras.rateLimit } : {}),
          ...(extras.httpCache ? { httpCache: extras.httpCache } : {}),
          ...invalidationOf(def, options, extras),
        },
        handler: handler as RouteHandlerMethod,
      });
    },
  };
}

import type {
  FastifyBaseLogger,
  FastifyInstance,
  FastifyRequest,
  onRequestAsyncHookHandler,
  RawReplyDefaultExpression,
  RawRequestDefaultExpression,
  RawServerDefault,
} from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { Actor, RequestOrigin } from "../../application/actor";
import type { TokenAudience } from "../../application/ports/token-service";

/** Instância do Fastify com o type provider do Zod (tipos de req/reply vêm dos schemas). */
export type ZodApp = FastifyInstance<
  RawServerDefault,
  RawRequestDefaultExpression,
  RawReplyDefaultExpression,
  FastifyBaseLogger,
  ZodTypeProvider
>;

export interface AuthGuards {
  /** Exige Bearer válido da audiência e preenche request.actor. */
  authenticate(audience: TokenAudience): onRequestAsyncHookHandler;
  /** Exige a permissão no ator (depois do authenticate). */
  authorize(permission: string): onRequestAsyncHookHandler;
}

declare module "fastify" {
  interface FastifyRequest {
    actor: Actor | null;
  }
  interface FastifyInstance {
    auth: AuthGuards;
  }
}

export function originOf(request: FastifyRequest): RequestOrigin {
  const userAgent = request.headers["user-agent"];
  return {
    ip: request.ip || null,
    userAgent: typeof userAgent === "string" ? userAgent : null,
    requestId: request.id,
  };
}

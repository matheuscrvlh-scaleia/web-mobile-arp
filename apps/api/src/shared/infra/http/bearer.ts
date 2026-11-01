import type { FastifyRequest } from "fastify";
import type {
  AccessClaims,
  TokenAudience,
  TokenService,
} from "../../application/ports/token-service";

type ClaimsOf<A extends TokenAudience> = Extract<AccessClaims, { audience: A }>;

/** Verificações já feitas nesta requisição (rate limit, auth e rota pública usam o mesmo token). */
const verified = new WeakMap<FastifyRequest, Map<TokenAudience, Promise<AccessClaims | null>>>();

/** Token do header Authorization: Bearer, ou null. */
export function bearerTokenOf(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

/**
 * Verifica o Bearer da requisição para a audiência, uma vez só por
 * requisição. Rejeita com o erro do TokenService (401) quando inválido.
 */
export function verifyBearer<A extends TokenAudience>(
  request: FastifyRequest,
  tokens: TokenService,
  audience: A,
): Promise<ClaimsOf<A>> {
  let byAudience = verified.get(request);
  if (!byAudience) {
    byAudience = new Map();
    verified.set(request, byAudience);
  }
  const token = bearerTokenOf(request);
  if (!token) return Promise.reject(new MissingBearerError());
  let pending = byAudience.get(audience) as Promise<ClaimsOf<A> | null> | undefined;
  if (!pending) {
    pending = tokens.verifyAccessToken(token, audience);
    // Guarda também a rejeição (sem "unhandled": quem chamou recebe o erro).
    pending.catch(() => {});
    byAudience.set(audience, pending);
  }
  return pending as Promise<ClaimsOf<A>>;
}

/** Mesmo que verifyBearer, mas null em vez de erro (rota pública e chave de rate limit). */
export async function tryVerifyBearer<A extends TokenAudience>(
  request: FastifyRequest,
  tokens: TokenService,
  audience: A,
): Promise<ClaimsOf<A> | null> {
  if (!bearerTokenOf(request)) return null;
  try {
    return await verifyBearer(request, tokens, audience);
  } catch {
    return null;
  }
}

class MissingBearerError extends Error {
  constructor() {
    super("Bearer ausente");
  }
}

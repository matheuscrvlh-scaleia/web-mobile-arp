import type { FastifyRequest } from "fastify";
import type { TokenService } from "../../../shared/application/ports/token-service";
import { tryVerifyBearer } from "../../../shared/infra/http/bearer";

export type OptionalVisitor = (request: FastifyRequest) => Promise<string | null>;

/**
 * Rotas públicas do app (home, lojas, agenda…) personalizam a resposta
 * quando há um Bearer válido do app. Token ausente, inválido, vencido ou de
 * visitante bloqueado = navegação anônima (nunca 401 numa rota pública).
 */
export function createOptionalVisitor(
  tokens: TokenService,
  isVisitorActive: (visitorId: string) => Promise<boolean>,
): OptionalVisitor {
  return async (request) => {
    const claims = await tryVerifyBearer(request, tokens, "app");
    if (!claims) return null;
    // Banco fora do ar não derruba a navegação: o conteúdo público pode vir do cache.
    const active = await isVisitorActive(claims.subject).catch(() => false);
    return active ? claims.subject : null;
  };
}

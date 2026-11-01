import { PERMISSIONS, type Permission } from "@arp/contracts";
import type { FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { hasPermission, type StaffActor, type VisitorActor } from "../../application/actor";
import type { TokenAudience, TokenService } from "../../application/ports/token-service";
import { ForbiddenError, UnauthenticatedError } from "../../domain/errors";
import { bearerTokenOf, verifyBearer } from "./bearer";
import { type AuthGuards, originOf } from "./types";

const KNOWN_PERMISSIONS = new Set<string>(PERMISSIONS);

export interface AuthPluginOptions {
  tokens: TokenService;
  /**
   * Visitante bloqueado não usa nem o access token ainda válido: a checagem
   * é uma leitura por PK a cada requisição do app.
   */
  isVisitorActive(visitorId: string): Promise<boolean>;
}

/**
 * Decora `app.auth` com os guardas de autenticação (por audiência) e de
 * permissão, e `request.actor` (null até autenticar).
 */
export const authPlugin = fp<AuthPluginOptions>(
  async (app, { tokens, isVisitorActive }) => {
    app.decorateRequest("actor", null);

    const authenticate: AuthGuards["authenticate"] = (audience: TokenAudience) =>
      async function authenticateRequest(request: FastifyRequest) {
        if (!bearerTokenOf(request)) throw new UnauthenticatedError();
        if (audience === "admin") {
          const claims = await verifyBearer(request, tokens, "admin");
          const actor: StaffActor = {
            type: "staff",
            id: claims.subject,
            name: claims.name,
            roleId: claims.roleId,
            permissions: new Set(
              claims.permissions.filter((p): p is Permission => KNOWN_PERMISSIONS.has(p)),
            ),
            storeId: claims.storeId,
            sessionId: claims.sessionId,
            origin: originOf(request),
          };
          request.actor = actor;
          return;
        }
        const claims = await verifyBearer(request, tokens, "app");
        if (!(await isVisitorActive(claims.subject))) {
          throw new UnauthenticatedError("Conta indisponível");
        }
        const actor: VisitorActor = {
          type: "visitor",
          id: claims.subject,
          name: claims.name,
          sessionId: claims.sessionId,
          origin: originOf(request),
        };
        request.actor = actor;
      };

    const authorize: AuthGuards["authorize"] = (permission: string) =>
      async function authorizeRequest(request: FastifyRequest) {
        const actor = request.actor;
        if (!actor) throw new UnauthenticatedError();
        if (!hasPermission(actor, permission as Permission)) throw new ForbiddenError();
      };

    app.decorate("auth", { authenticate, authorize });
  },
  { name: "arp-auth" },
);

/** Ator do painel da requisição (rota com authenticate("admin")). */
export function staffOf(request: FastifyRequest): StaffActor {
  const actor = request.actor;
  if (!actor) throw new UnauthenticatedError();
  if (actor.type !== "staff") throw new ForbiddenError();
  return actor;
}

/** Visitante da requisição (rota com authenticate("app")). */
export function visitorOf(request: FastifyRequest): VisitorActor {
  const actor = request.actor;
  if (!actor) throw new UnauthenticatedError();
  if (actor.type !== "visitor") throw new ForbiddenError();
  return actor;
}

import { createHash } from "node:crypto";
import { App, type AuthUser } from "@arp/contracts";
import type { FastifyRequest } from "fastify";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { UnauthenticatedError } from "../../../shared/domain/errors";
import { staffOf } from "../../../shared/infra/http/auth";
import { actorRateLimitKey } from "../../../shared/infra/http/rate-limit";
import { createRouter } from "../../../shared/infra/http/router";
import { originOf } from "../../../shared/infra/http/types";
import { iso } from "../../../shared/infra/presenters";
import type { GetMerchantOverviewUseCase } from "../application/get-merchant-overview.use-case";
import type { LookupMerchantClaimUseCase } from "../application/lookup-merchant-claim.use-case";
import type { MerchantLoginUseCase } from "../application/merchant-login.use-case";
import type { MerchantLogoutUseCase } from "../application/merchant-logout.use-case";
import type { MerchantSessionResult } from "../application/merchant-session";
import type { RedeemMerchantClaimUseCase } from "../application/redeem-merchant-claim.use-case";
import type { RefreshMerchantSessionUseCase } from "../application/refresh-merchant-session.use-case";

export interface MerchantRoutesDeps {
  login: MerchantLoginUseCase;
  refresh: RefreshMerchantSessionUseCase;
  logout: MerchantLogoutUseCase;
  lookup: LookupMerchantClaimUseCase;
  redeem: RedeemMerchantClaimUseCase;
  overview: GetMerchantOverviewUseCase;
  /** Usuário no formato do /auth/me do painel. */
  authUser(userId: string): Promise<AuthUser | null>;
  /** distributed: conta no Postgres (RATE_LIMIT_STORE=postgres), igual em todas as réplicas. */
  loginRateLimit: { max: number; timeWindow: string; distributed?: boolean };
}

const { MERCHANT_ROUTES } = App;

export function merchantRoutes(deps: MerchantRoutesDeps): FastifyPluginAsyncZod {
  const respond = async (session: MerchantSessionResult): Promise<App.MerchantSession> => {
    const user = await deps.authUser(session.userId);
    if (!user) throw new UnauthenticatedError();
    return {
      accessToken: session.accessToken,
      expiresIn: session.expiresIn,
      refreshToken: session.refreshToken,
      refreshExpiresAt: iso(session.refreshExpiresAt),
      user,
      stores: session.stores,
      allStores: session.allStores,
    };
  };

  // Caixa digitando códigos: freia tentativa em massa por usuário (como no painel).
  const codeAttempts = (name: string) => ({
    max: 120,
    timeWindow: "1 minute",
    keyGenerator: actorRateLimitKey(`merchant-claims-${name}`),
  });

  return async (app) => {
    // Audiência "admin": o Bearer do lojista é o mesmo access token do painel.
    const r = createRouter(app, { audience: "admin", tag: "App: lojista" });

    r.route(
      MERCHANT_ROUTES.auth.login,
      { body: App.merchantLoginBodySchema, response: { 200: App.merchantSessionSchema } },
      async (request) =>
        respond(await deps.login.execute({ ...request.body, origin: originOf(request) })),
      {
        // Por IP + e-mail, como o login do painel.
        rateLimit: {
          ...deps.loginRateLimit,
          hook: "preHandler",
          keyGenerator: (request: FastifyRequest) => {
            const body = request.body as { email?: unknown } | undefined;
            const email = typeof body?.email === "string" ? body.email.toLowerCase() : "";
            return `merchant-login:${request.ip}:${email}`;
          },
        },
      },
    );

    r.route(
      MERCHANT_ROUTES.auth.refresh,
      { body: App.merchantRefreshBodySchema, response: { 200: App.merchantSessionSchema } },
      async (request) =>
        respond(
          await deps.refresh.execute({
            refreshToken: request.body.refreshToken,
            origin: originOf(request),
          }),
        ),
      // Por token (como o refresh do visitante): lojas do complexo saem pelo
      // mesmo NAT. O limite só segura laço de retentativa.
      {
        rateLimit: {
          max: deps.loginRateLimit.max,
          timeWindow: deps.loginRateLimit.timeWindow,
          distributed: deps.loginRateLimit.distributed ?? false,
          hook: "preHandler",
          keyGenerator: (request: FastifyRequest) => {
            const token = (request.body as { refreshToken?: unknown } | undefined)?.refreshToken;
            return typeof token === "string"
              ? `merchant-refresh:${createHash("sha256").update(token).digest("base64url")}`
              : `merchant-refresh-ip:${request.ip}`;
          },
        },
      },
    );

    r.route(
      MERCHANT_ROUTES.auth.logout,
      { body: App.merchantRefreshBodySchema },
      async (request, reply) => {
        await deps.logout.execute({ refreshToken: request.body.refreshToken });
        return reply.status(204).send();
      },
    );

    r.route(
      MERCHANT_ROUTES.claims.lookup,
      { querystring: App.merchantLookupQuerySchema, response: { 200: App.merchantClaimSchema } },
      async (request) => deps.lookup.execute(request.query, staffOf(request)),
      { rateLimit: codeAttempts("lookup") },
    );

    r.route(
      MERCHANT_ROUTES.claims.redeem,
      { body: App.merchantRedeemBodySchema, response: { 200: App.merchantClaimSchema } },
      async (request) => deps.redeem.execute(request.body, staffOf(request)),
      { rateLimit: codeAttempts("redeem") },
    );

    r.route(
      MERCHANT_ROUTES.overview,
      {
        querystring: App.merchantOverviewQuerySchema,
        response: { 200: App.merchantOverviewSchema },
      },
      async (request) => deps.overview.execute(request.query, staffOf(request)),
    );
  };
}

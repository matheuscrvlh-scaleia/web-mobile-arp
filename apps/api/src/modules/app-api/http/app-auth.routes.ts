import { createHash } from "node:crypto";
import { App } from "@arp/contracts";
import type { FastifyRequest } from "fastify";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { decodeJwt } from "jose";
import type { Clock } from "../../../shared/application/ports/clock";
import { orNotFound } from "../../../shared/domain/errors";
import { visitorOf } from "../../../shared/infra/http/auth";
import { createRouter } from "../../../shared/infra/http/router";
import { originOf } from "../../../shared/infra/http/types";
import { iso } from "../../../shared/infra/presenters";
import type { RefreshVisitorSessionUseCase } from "../application/refresh-visitor-session.use-case";
import type { RegisterVisitorUseCase } from "../application/register-visitor.use-case";
import type { RequestPasswordResetUseCase } from "../application/request-password-reset.use-case";
import type { ResetPasswordUseCase } from "../application/reset-password.use-case";
import type { SocialLoginUseCase } from "../application/social-login.use-case";
import type { UpdateMyProfileUseCase } from "../application/update-my-profile.use-case";
import type { VisitorLoginUseCase } from "../application/visitor-login.use-case";
import type { VisitorLogoutUseCase } from "../application/visitor-logout.use-case";
import type { VisitorSessionResult } from "../application/visitor-session";
import type { VisitorQueries } from "../infra/visitor.queries";

export interface AppAuthRoutesDeps {
  register: RegisterVisitorUseCase;
  login: VisitorLoginUseCase;
  socialLogin: SocialLoginUseCase;
  forgotPassword: RequestPasswordResetUseCase;
  resetPassword: ResetPasswordUseCase;
  refresh: RefreshVisitorSessionUseCase;
  logout: VisitorLogoutUseCase;
  updateProfile: UpdateMyProfileUseCase;
  visitors: VisitorQueries;
  clock: Clock;
  /** distributed: conta no Postgres (RATE_LIMIT_STORE=postgres), igual em todas as réplicas. */
  authRateLimit: { max: number; timeWindow: string; distributed?: boolean };
}

const { APP_ROUTES } = App;

/**
 * Chave do limite do login social: IP + e-mail (ou sub) lido do id_token SEM
 * validar. Forjar o claim não ajuda ninguém: a assinatura é conferida depois
 * e o limite global por IP continua valendo.
 */
function socialLimitKey(request: FastifyRequest): string {
  const token = (request.body as { idToken?: unknown } | undefined)?.idToken;
  let who = "";
  if (typeof token === "string") {
    try {
      const claims = decodeJwt(token);
      who = String(claims.email ?? claims.sub ?? "")
        .toLowerCase()
        .slice(0, 320);
    } catch {
      // Token malformado: fica só o IP.
    }
  }
  return `app-auth-social:${request.ip}:${who}`;
}

export function appAuthRoutes(deps: AppAuthRoutesDeps): FastifyPluginAsyncZod {
  const profileOf = async (visitorId: string) =>
    orNotFound(await deps.visitors.profile(visitorId), "Conta não encontrada");
  const respond = async (session: VisitorSessionResult): Promise<App.Session> => ({
    accessToken: session.accessToken,
    expiresIn: session.expiresIn,
    refreshToken: session.refreshToken,
    refreshExpiresAt: iso(session.refreshExpiresAt),
    visitor: await profileOf(session.visitorId),
  });
  // Por IP + e-mail: freia força bruta e cadastro em massa sem travar uma rede inteira.
  const authLimit = {
    ...deps.authRateLimit,
    hook: "preHandler",
    keyGenerator: (request: FastifyRequest) => {
      const body = request.body as { email?: unknown } | undefined;
      const email = typeof body?.email === "string" ? body.email.toLowerCase() : "";
      return `app-auth:${request.ip}:${email}`;
    },
  };

  return async (app) => {
    const r = createRouter(app, { audience: "app", tag: "App: conta" });

    r.route(
      APP_ROUTES.auth.register,
      { body: App.registerBodySchema, response: { 201: App.sessionSchema } },
      async (request, reply) => {
        const { acceptTerms: _accepted, ...input } = request.body;
        const session = await deps.register.execute({ ...input, origin: originOf(request) });
        return reply.status(201).send(await respond(session));
      },
      { rateLimit: authLimit },
    );

    r.route(
      APP_ROUTES.auth.login,
      { body: App.loginBodySchema, response: { 200: App.sessionSchema } },
      async (request) =>
        respond(await deps.login.execute({ ...request.body, origin: originOf(request) })),
      { rateLimit: authLimit },
    );

    r.route(
      APP_ROUTES.auth.social,
      { body: App.socialLoginBodySchema, response: { 200: App.sessionSchema } },
      async (request) =>
        respond(await deps.socialLogin.execute({ ...request.body, origin: originOf(request) })),
      // Mesmo limite, por IP + e-mail do token (sem e-mail no corpo, só o IP travaria o NAT do wi-fi).
      { rateLimit: { ...authLimit, keyGenerator: socialLimitKey } },
    );

    r.route(
      APP_ROUTES.auth.forgotPassword,
      { body: App.forgotPasswordBodySchema },
      async (request, reply) => {
        await deps.forgotPassword.execute(request.body);
        return reply.status(204).send();
      },
      { rateLimit: authLimit },
    );

    r.route(
      APP_ROUTES.auth.resetPassword,
      { body: App.resetPasswordBodySchema, response: { 200: App.sessionSchema } },
      async (request) =>
        respond(await deps.resetPassword.execute({ ...request.body, origin: originOf(request) })),
      { rateLimit: authLimit },
    );

    r.route(
      APP_ROUTES.auth.refresh,
      { body: App.refreshBodySchema, response: { 200: App.sessionSchema } },
      async (request) =>
        respond(
          await deps.refresh.execute({
            refreshToken: request.body.refreshToken,
            origin: originOf(request),
          }),
        ),
      // Por token, não por IP: depois de um push, centenas de aparelhos no NAT
      // do wi-fi renovam juntos. Um aparelho renova a cada ~15 min; o limite
      // só segura laço de retentativa. Token inventado custa uma busca no
      // índice e cai no limite global por IP.
      {
        rateLimit: {
          max: deps.authRateLimit.max,
          timeWindow: deps.authRateLimit.timeWindow,
          distributed: deps.authRateLimit.distributed ?? false,
          hook: "preHandler",
          keyGenerator: (request: FastifyRequest) => {
            const token = (request.body as { refreshToken?: unknown } | undefined)?.refreshToken;
            return typeof token === "string"
              ? `app-refresh:${createHash("sha256").update(token).digest("base64url")}`
              : `app-refresh-ip:${request.ip}`;
          },
        },
      },
    );

    r.route(APP_ROUTES.auth.logout, { body: App.logoutBodySchema }, async (request, reply) => {
      await deps.logout.execute(request.body);
      return reply.status(204).send();
    });

    r.route(APP_ROUTES.me.get, { response: { 200: App.meSchema } }, async (request) => {
      const visitor = visitorOf(request);
      return {
        visitor: await profileOf(visitor.id),
        summary: await deps.visitors.monthSummary(visitor.id, deps.clock.now()),
      };
    });

    r.route(
      APP_ROUTES.me.update,
      { body: App.updateMeBodySchema, response: { 200: App.meSchema } },
      async (request) => {
        const visitor = visitorOf(request);
        await deps.updateProfile.execute(request.body, visitor);
        return {
          visitor: await profileOf(visitor.id),
          summary: await deps.visitors.monthSummary(visitor.id, deps.clock.now()),
        };
      },
    );
  };
}

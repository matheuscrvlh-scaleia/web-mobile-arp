import {
  API_PREFIX,
  authUserSchema,
  changePasswordBodySchema,
  loginBodySchema,
  REFRESH_COOKIE,
  ROUTES,
  type SessionResponse,
  sessionResponseSchema,
} from "@arp/contracts";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { orNotFound, UnauthenticatedError } from "../../../shared/domain/errors";
import { staffOf } from "../../../shared/infra/http/auth";
import { createRouter } from "../../../shared/infra/http/router";
import { originOf } from "../../../shared/infra/http/types";
import type { ChangePasswordUseCase } from "../application/change-password.use-case";
import type { LoginUseCase, StaffSessionResult } from "../application/login.use-case";
import type { LogoutUseCase } from "../application/logout.use-case";
import type { RefreshSessionUseCase } from "../application/refresh-session.use-case";
import { USER_NOT_FOUND } from "../application/user-rules";
import type { IdentityQueries } from "../infra/identity.queries";

export interface AuthRoutesDeps {
  login: LoginUseCase;
  refresh: RefreshSessionUseCase;
  logout: LogoutUseCase;
  changePassword: ChangePasswordUseCase;
  queries: IdentityQueries;
  cookieSecure: boolean;
  loginRateLimit: { max: number; timeWindow: string; distributed?: boolean };
}

const COOKIE_PATH = `${API_PREFIX}/auth`;

export function authRoutes(deps: AuthRoutesDeps): FastifyPluginAsyncZod {
  const setRefreshCookie = (reply: FastifyReply, session: StaffSessionResult) =>
    reply.setCookie(REFRESH_COOKIE, session.refreshToken, {
      httpOnly: true,
      sameSite: "strict",
      secure: deps.cookieSecure,
      path: COOKIE_PATH,
      expires: session.refreshExpiresAt,
    });
  const clearRefreshCookie = (reply: FastifyReply) =>
    reply.clearCookie(REFRESH_COOKIE, {
      httpOnly: true,
      sameSite: "strict",
      secure: deps.cookieSecure,
      path: COOKIE_PATH,
    });

  const respond = async (session: StaffSessionResult): Promise<SessionResponse> => {
    const user = await deps.queries.authUser(session.userId);
    if (!user) throw new UnauthenticatedError();
    return { accessToken: session.accessToken, expiresIn: session.expiresIn, user };
  };

  return async (app) => {
    const r = createRouter(app, { audience: "admin", tag: "Autenticação" });

    r.route(
      ROUTES.auth.login,
      { body: loginBodySchema, response: { 200: sessionResponseSchema } },
      async (request, reply) => {
        const session = await deps.login.execute({ ...request.body, origin: originOf(request) });
        setRefreshCookie(reply, session);
        return respond(session);
      },
      {
        // Por IP + e-mail: freia força bruta numa conta sem travar o escritório inteiro.
        rateLimit: {
          ...deps.loginRateLimit,
          hook: "preHandler",
          keyGenerator: (request: FastifyRequest) => {
            const body = request.body as { email?: unknown } | undefined;
            const email = typeof body?.email === "string" ? body.email.toLowerCase() : "";
            return `login:${request.ip}:${email}`;
          },
        },
      },
    );

    r.route(
      ROUTES.auth.refresh,
      { response: { 200: sessionResponseSchema } },
      async (request, reply) => {
        const refreshToken = request.cookies[REFRESH_COOKIE];
        if (!refreshToken) throw new UnauthenticatedError();
        try {
          const session = await deps.refresh.execute({ refreshToken, origin: originOf(request) });
          setRefreshCookie(reply, session);
          return await respond(session);
        } catch (err) {
          clearRefreshCookie(reply);
          throw err;
        }
      },
    );

    r.route(ROUTES.auth.logout, {}, async (request, reply) => {
      await deps.logout.execute({ refreshToken: request.cookies[REFRESH_COOKIE] });
      clearRefreshCookie(reply);
      return reply.status(204).send();
    });

    r.route(ROUTES.auth.me, { response: { 200: authUserSchema } }, async (request) => {
      return orNotFound(await deps.queries.authUser(staffOf(request).id), USER_NOT_FOUND);
    });

    r.route(
      ROUTES.auth.changePassword,
      { body: changePasswordBodySchema },
      async (request, reply) => {
        await deps.changePassword.execute(request.body, staffOf(request));
        return reply.status(204).send();
      },
    );
  };
}

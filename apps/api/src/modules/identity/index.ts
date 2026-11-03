import { PERMISSIONS } from "@arp/contracts";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { CoreDeps } from "../../shared/infra/core";
import type { Job } from "../../shared/infra/jobs/scheduler";
import { ChangePasswordUseCase } from "./application/change-password.use-case";
import { CreateRoleUseCase } from "./application/create-role.use-case";
import { CreateUserUseCase } from "./application/create-user.use-case";
import { DeleteRoleUseCase } from "./application/delete-role.use-case";
import { DeleteUserUseCase } from "./application/delete-user.use-case";
import { LoginUseCase } from "./application/login.use-case";
import { LogoutUseCase } from "./application/logout.use-case";
import { RefreshSessionUseCase } from "./application/refresh-session.use-case";
import { ResetUserPasswordUseCase } from "./application/reset-user-password.use-case";
import { SessionService } from "./application/session-service";
import { UpdateRoleUseCase } from "./application/update-role.use-case";
import { UpdateUserUseCase } from "./application/update-user.use-case";
import { authRoutes } from "./http/auth.routes";
import { usersRoutes } from "./http/users.routes";
import { IdentityQueries } from "./infra/identity.queries";
import {
  PgRoleRepository,
  PgSessionRepository,
  PgStoreExistence,
  PgUserRepository,
} from "./infra/pg-identity-repositories";

export type { SessionService } from "./application/session-service";
export { signStaffToken } from "./application/staff-token-issuer";

export function createIdentityModule(core: CoreDeps) {
  const { db, uow, clock, hasher, tokens, opaqueTokens, random, audit, config } = core;
  const roles = new PgRoleRepository(db);
  const users = new PgUserRepository(db);
  const sessionRepository = new PgSessionRepository(db);
  const queries = new IdentityQueries(db, new Set(PERMISSIONS));
  const sessions = new SessionService({
    sessions: sessionRepository,
    opaqueTokens,
    clock,
    uow,
    ttlDays: config.refreshTtlDays,
    reuseGraceMs: config.refreshReuseGraceMs,
  });
  const roleDeps = { roles, audit, uow };
  const userDeps = {
    users,
    roles,
    stores: new PgStoreExistence(db),
    hasher,
    random,
    sessions,
    audit,
    uow,
  };

  const routes: FastifyPluginAsyncZod = async (app) => {
    await app.register(
      authRoutes({
        login: new LoginUseCase({
          users,
          profiles: users,
          hasher,
          sessions,
          tokens,
          audit,
          clock,
          uow,
        }),
        refresh: new RefreshSessionUseCase({ sessions, profiles: users, tokens }),
        logout: new LogoutUseCase({ sessions }),
        changePassword: new ChangePasswordUseCase({ users, hasher, sessions, audit, uow }),
        queries,
        cookieSecure: config.cookieSecure,
        loginRateLimit: config.loginRateLimit,
      }),
    );
    await app.register(
      usersRoutes({
        queries,
        createRole: new CreateRoleUseCase(roleDeps),
        updateRole: new UpdateRoleUseCase(roleDeps),
        deleteRole: new DeleteRoleUseCase(roleDeps),
        createUser: new CreateUserUseCase(userDeps),
        updateUser: new UpdateUserUseCase(userDeps),
        deleteUser: new DeleteUserUseCase(userDeps),
        resetPassword: new ResetUserPasswordUseCase(userDeps),
      }),
    );
  };

  // Sessões vencidas há mais de um dia não servem nem para detectar reuso: saem do banco.
  const cleanupJob: Job = {
    name: "delete-expired-sessions",
    intervalMs: 60 * 60_000,
    async run() {
      const olderThan = new Date(clock.now().getTime() - 86_400_000);
      let deleted = 0;
      for (;;) {
        const batch = await sessionRepository.deleteExpired(olderThan, 1_000);
        deleted += batch;
        if (batch < 1_000) break;
      }
      // Rotações com mais de 7 dias: o token antigo já foi trocado há muito tempo.
      const rotatedBefore = new Date(clock.now().getTime() - 7 * 86_400_000);
      for (;;) {
        const batch = await sessionRepository.deleteRotated(rotatedBefore, 1_000);
        deleted += batch;
        if (batch < 1_000) break;
      }
      if (deleted > 0) core.logger.info({ deleted }, "Sessões vencidas apagadas");
    },
  };

  return {
    routes,
    sessions,
    /** Usuário logado no formato do /auth/me (login do lojista no app). */
    authUser: (userId: string) => queries.authUser(userId),
    jobs: [cleanupJob],
  };
}

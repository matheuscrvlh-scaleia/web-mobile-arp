import {
  createRoleBodySchema,
  createUserBodySchema,
  createUserResponseSchema,
  idParamsSchema,
  listUsersQuerySchema,
  PERMISSION_CATALOG,
  permissionCatalogSchema,
  ROUTES,
  resetPasswordResponseSchema,
  roleListSchema,
  roleSchema,
  updateRoleBodySchema,
  updateUserBodySchema,
  userPageSchema,
  userSchema,
} from "@arp/contracts";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { orNotFound } from "../../../shared/domain/errors";
import { staffOf } from "../../../shared/infra/http/auth";
import { createRouter } from "../../../shared/infra/http/router";
import type { CreateRoleUseCase } from "../application/create-role.use-case";
import type { CreateUserUseCase } from "../application/create-user.use-case";
import type { DeleteRoleUseCase } from "../application/delete-role.use-case";
import type { ResetUserPasswordUseCase } from "../application/reset-user-password.use-case";
import { ROLE_NOT_FOUND } from "../application/role-deps";
import type { UpdateRoleUseCase } from "../application/update-role.use-case";
import type { UpdateUserUseCase } from "../application/update-user.use-case";
import { USER_NOT_FOUND } from "../application/user-rules";
import type { IdentityQueries } from "../infra/identity.queries";

export interface UsersRoutesDeps {
  queries: IdentityQueries;
  createRole: CreateRoleUseCase;
  updateRole: UpdateRoleUseCase;
  deleteRole: DeleteRoleUseCase;
  createUser: CreateUserUseCase;
  updateUser: UpdateUserUseCase;
  resetPassword: ResetUserPasswordUseCase;
}

const catalog = {
  data: PERMISSION_CATALOG.map((g) => ({
    group: g.group,
    items: g.items.map((i) => ({ key: i.key, label: i.label, description: i.description })),
  })),
};

export function usersRoutes(deps: UsersRoutesDeps): FastifyPluginAsyncZod {
  const { queries } = deps;
  const role = async (id: string) => orNotFound(await queries.getRole(id), ROLE_NOT_FOUND);
  const user = async (id: string) => orNotFound(await queries.getUser(id), USER_NOT_FOUND);

  return async (app) => {
    const r = createRouter(app, { audience: "admin", tag: "Usuários e cargos" });

    r.route(
      ROUTES.permissions,
      { response: { 200: permissionCatalogSchema } },
      async () => catalog,
    );

    r.route(ROUTES.roles.list, { response: { 200: roleListSchema } }, async () => ({
      data: await queries.listRoles(),
    }));

    r.route(
      ROUTES.roles.create,
      { body: createRoleBodySchema, response: { 201: roleSchema } },
      async (request, reply) => {
        const id = await deps.createRole.execute(request.body, staffOf(request));
        return reply.status(201).send(await role(id));
      },
    );

    r.route(
      ROUTES.roles.update,
      { params: idParamsSchema, body: updateRoleBodySchema, response: { 200: roleSchema } },
      async (request) => {
        await deps.updateRole.execute(
          { id: request.params.id, changes: request.body },
          staffOf(request),
        );
        return role(request.params.id);
      },
    );

    r.route(ROUTES.roles.remove, { params: idParamsSchema }, async (request, reply) => {
      await deps.deleteRole.execute({ id: request.params.id }, staffOf(request));
      return reply.status(204).send();
    });

    r.route(
      ROUTES.users.list,
      { querystring: listUsersQuerySchema, response: { 200: userPageSchema } },
      async (request) => queries.listUsers(request.query),
    );

    r.route(
      ROUTES.users.get,
      { params: idParamsSchema, response: { 200: userSchema } },
      async (request) => user(request.params.id),
    );

    r.route(
      ROUTES.users.create,
      { body: createUserBodySchema, response: { 201: createUserResponseSchema } },
      async (request, reply) => {
        const result = await deps.createUser.execute(request.body, staffOf(request));
        return reply.status(201).send({
          user: await user(result.userId),
          temporaryPassword: result.temporaryPassword,
        });
      },
    );

    r.route(
      ROUTES.users.update,
      { params: idParamsSchema, body: updateUserBodySchema, response: { 200: userSchema } },
      async (request) => {
        await deps.updateUser.execute(
          { id: request.params.id, changes: request.body },
          staffOf(request),
        );
        return user(request.params.id);
      },
    );

    r.route(
      ROUTES.users.resetPassword,
      { params: idParamsSchema, response: { 200: resetPasswordResponseSchema } },
      async (request) => deps.resetPassword.execute({ id: request.params.id }, staffOf(request)),
    );
  };
}

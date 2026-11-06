import {
  activeMerchantInviteListSchema,
  createMerchantInviteBodySchema,
  idParamsSchema,
  listMerchantInvitesQuerySchema,
  listMerchantSignupsQuerySchema,
  merchantInvitationSchema,
  merchantInviteSchema,
  merchantInviteTokenParamsSchema,
  merchantSignupBodySchema,
  merchantSignupListSchema,
  merchantSignupSchema,
  ROUTES,
} from "@arp/contracts";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { CoreDeps } from "../../shared/infra/core";
import { staffOf } from "../../shared/infra/http/auth";
import { createRouter } from "../../shared/infra/http/router";
import { MerchantSignupService } from "./merchant-signup";

/** Rotas públicas do link: poucas tentativas por IP (o token já é longo). */
const PUBLIC_LIMIT = { rateLimit: { max: 20, timeWindow: "1 minute", distributed: true } };

/** Cadastro de lojista pelo link e aprovação (Fase 2). */
export function createMerchantSignupModule(core: CoreDeps) {
  const service = new MerchantSignupService({
    db: core.db,
    uow: core.uow,
    clock: core.clock,
    audit: core.audit,
    hasher: core.hasher,
    opaqueTokens: core.opaqueTokens,
    mailer: core.mailer,
    logger: core.logger,
  });
  const S = ROUTES.merchantSignups;

  const routes: FastifyPluginAsyncZod = async (app) => {
    const r = createRouter(app, { audience: "admin", tag: "Lojistas" });

    r.route(
      S.invite,
      { body: createMerchantInviteBodySchema, response: { 201: merchantInviteSchema } },
      async (request, reply) =>
        reply
          .status(201)
          .send(await service.invite(request.body.storeId, staffOf(request), request.body.replace)),
    );
    r.route(
      S.invites,
      {
        querystring: listMerchantInvitesQuerySchema,
        response: { 200: activeMerchantInviteListSchema },
      },
      async (request) => ({ data: await service.invites(request.query) }),
    );
    r.route(S.cancelInvite, { params: idParamsSchema }, async (request, reply) => {
      await service.cancelInvite(request.params.id, staffOf(request));
      return reply.status(204).send();
    });
    r.route(
      S.invitation,
      { params: merchantInviteTokenParamsSchema, response: { 200: merchantInvitationSchema } },
      async (request) => service.invitation(request.params.token),
      PUBLIC_LIMIT,
    );
    r.route(
      S.signup,
      { params: merchantInviteTokenParamsSchema, body: merchantSignupBodySchema },
      async (request, reply) => {
        await service.signup(request.params.token, request.body);
        return reply.status(204).send();
      },
      PUBLIC_LIMIT,
    );
    r.route(
      S.list,
      { querystring: listMerchantSignupsQuerySchema, response: { 200: merchantSignupListSchema } },
      async (request) => ({ data: await service.list(request.query) }),
    );
    r.route(
      S.approve,
      { params: idParamsSchema, response: { 200: merchantSignupSchema } },
      async (request) => service.approve(request.params.id, staffOf(request)),
    );
    r.route(
      S.reject,
      { params: idParamsSchema, response: { 200: merchantSignupSchema } },
      async (request) => service.reject(request.params.id, staffOf(request)),
    );
  };
  return { routes };
}

import {
  campaignListSchema,
  campaignSchema,
  challengeListSchema,
  challengeSchema,
  createCampaignBodySchema,
  createChallengeBodySchema,
  createQrCodeBodySchema,
  createSealBodySchema,
  earnedSealPageSchema,
  idParamsSchema,
  listChallengesQuerySchema,
  listEarnedSealsQuerySchema,
  qrCodeListSchema,
  qrCodeSchema,
  ROUTES,
  replaceTiersBodySchema,
  sealListSchema,
  sealSchema,
  updateCampaignBodySchema,
  updateChallengeBodySchema,
  updateQrCodeBodySchema,
  updateSealBodySchema,
} from "@arp/contracts";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { APP_CONTENT_CACHE_PREFIX } from "../../../shared/application/ports/cache";
import { orNotFound } from "../../../shared/domain/errors";
import { staffOf } from "../../../shared/infra/http/auth";
import { createRouter } from "../../../shared/infra/http/router";
import { toDate } from "../../../shared/infra/presenters";
import type { CreateCampaignUseCase } from "../application/create-campaign.use-case";
import type { CreateChallengeUseCase } from "../application/create-challenge.use-case";
import type { CreateQrCodeUseCase } from "../application/create-qr-code.use-case";
import type { CreateSealUseCase } from "../application/create-seal.use-case";
import type { DeleteChallengeUseCase } from "../application/delete-challenge.use-case";
import {
  CAMPAIGN_NOT_FOUND,
  CHALLENGE_NOT_FOUND,
  QR_CODE_NOT_FOUND,
  SEAL_NOT_FOUND,
} from "../application/gamification-deps";
import type { ReplaceCampaignTiersUseCase } from "../application/replace-campaign-tiers.use-case";
import type { UpdateCampaignUseCase } from "../application/update-campaign.use-case";
import type { UpdateChallengeUseCase } from "../application/update-challenge.use-case";
import type { UpdateQrCodeUseCase } from "../application/update-qr-code.use-case";
import type { UpdateSealUseCase } from "../application/update-seal.use-case";
import type { GamificationQueries } from "../infra/gamification.queries";

export interface GamificationRoutesDeps {
  queries: GamificationQueries;
  createSeal: CreateSealUseCase;
  updateSeal: UpdateSealUseCase;
  createCampaign: CreateCampaignUseCase;
  updateCampaign: UpdateCampaignUseCase;
  replaceTiers: ReplaceCampaignTiersUseCase;
  createChallenge: CreateChallengeUseCase;
  updateChallenge: UpdateChallengeUseCase;
  deleteChallenge: DeleteChallengeUseCase;
  createQrCode: CreateQrCodeUseCase;
  updateQrCode: UpdateQrCodeUseCase;
}

export function gamificationRoutes(deps: GamificationRoutesDeps): FastifyPluginAsyncZod {
  const { queries } = deps;
  const seal = async (id: string) => orNotFound(await queries.getSeal(id), SEAL_NOT_FOUND);
  const campaign = async (id: string) =>
    orNotFound(await queries.getCampaign(id), CAMPAIGN_NOT_FOUND);
  const challenge = async (id: string) =>
    orNotFound(await queries.getChallenge(id), CHALLENGE_NOT_FOUND);
  const qrCode = async (id: string) => orNotFound(await queries.getQrCode(id), QR_CODE_NOT_FOUND);

  return async (app) => {
    const r = createRouter(app, {
      audience: "admin",
      tag: "Selos e desafios",
      // Escrita aqui muda o que o app mostra: limpa as leituras compartilhadas.
      invalidates: [APP_CONTENT_CACHE_PREFIX],
    });

    /* Selos */

    r.route(ROUTES.seals.list, { response: { 200: sealListSchema } }, async () => ({
      data: await queries.listSeals(),
    }));

    r.route(
      ROUTES.seals.create,
      { body: createSealBodySchema, response: { 201: sealSchema } },
      async (request, reply) => {
        const id = await deps.createSeal.execute(request.body, staffOf(request));
        return reply.status(201).send(await seal(id));
      },
    );

    r.route(
      ROUTES.seals.update,
      { params: idParamsSchema, body: updateSealBodySchema, response: { 200: sealSchema } },
      async (request) => {
        await deps.updateSeal.execute(
          { id: request.params.id, changes: request.body },
          staffOf(request),
        );
        return seal(request.params.id);
      },
    );

    /* Campanhas */

    r.route(ROUTES.campaigns.list, { response: { 200: campaignListSchema } }, async () => ({
      data: await queries.listCampaigns(),
    }));

    r.route(
      ROUTES.campaigns.get,
      { params: idParamsSchema, response: { 200: campaignSchema } },
      async (request) => campaign(request.params.id),
    );

    r.route(
      ROUTES.campaigns.create,
      { body: createCampaignBodySchema, response: { 201: campaignSchema } },
      async (request, reply) => {
        const { startsAt, endsAt, ...body } = request.body;
        const id = await deps.createCampaign.execute(
          { ...body, startsAt: toDate(startsAt), endsAt: toDate(endsAt) },
          staffOf(request),
        );
        return reply.status(201).send(await campaign(id));
      },
    );

    r.route(
      ROUTES.campaigns.update,
      { params: idParamsSchema, body: updateCampaignBodySchema, response: { 200: campaignSchema } },
      async (request) => {
        const { startsAt, endsAt, ...changes } = request.body;
        await deps.updateCampaign.execute(
          {
            id: request.params.id,
            changes: {
              ...changes,
              startsAt: toDate(startsAt),
              endsAt: toDate(endsAt),
            },
          },
          staffOf(request),
        );
        return campaign(request.params.id);
      },
    );

    r.route(
      ROUTES.campaigns.replaceTiers,
      { params: idParamsSchema, body: replaceTiersBodySchema, response: { 200: campaignSchema } },
      async (request) => {
        await deps.replaceTiers.execute(
          { id: request.params.id, tiers: request.body.tiers },
          staffOf(request),
        );
        return campaign(request.params.id);
      },
    );

    /* Desafios */

    r.route(
      ROUTES.challenges.list,
      { querystring: listChallengesQuerySchema, response: { 200: challengeListSchema } },
      async (request) => ({ data: await queries.listChallenges(request.query) }),
    );

    r.route(
      ROUTES.challenges.get,
      { params: idParamsSchema, response: { 200: challengeSchema } },
      async (request) => challenge(request.params.id),
    );

    r.route(
      ROUTES.challenges.create,
      { body: createChallengeBodySchema, response: { 201: challengeSchema } },
      async (request, reply) => {
        const id = await deps.createChallenge.execute(request.body, staffOf(request));
        return reply.status(201).send(await challenge(id));
      },
    );

    r.route(
      ROUTES.challenges.update,
      {
        params: idParamsSchema,
        body: updateChallengeBodySchema,
        response: { 200: challengeSchema },
      },
      async (request) => {
        await deps.updateChallenge.execute(
          { id: request.params.id, changes: request.body },
          staffOf(request),
        );
        return challenge(request.params.id);
      },
    );

    r.route(ROUTES.challenges.remove, { params: idParamsSchema }, async (request, reply) => {
      await deps.deleteChallenge.execute({ id: request.params.id }, staffOf(request));
      return reply.status(204).send();
    });

    /* QR Codes */

    r.route(
      ROUTES.qrCodes.list,
      { params: idParamsSchema, response: { 200: qrCodeListSchema } },
      async (request) => {
        await challenge(request.params.id);
        return { data: await queries.listQrCodes(request.params.id) };
      },
    );

    r.route(
      ROUTES.qrCodes.create,
      { params: idParamsSchema, body: createQrCodeBodySchema, response: { 201: qrCodeSchema } },
      async (request, reply) => {
        const id = await deps.createQrCode.execute(
          {
            challengeId: request.params.id,
            label: request.body.label,
            validFrom: toDate(request.body.validFrom),
            validUntil: toDate(request.body.validUntil),
          },
          staffOf(request),
        );
        return reply.status(201).send(await qrCode(id));
      },
    );

    r.route(
      ROUTES.qrCodes.update,
      { params: idParamsSchema, body: updateQrCodeBodySchema, response: { 200: qrCodeSchema } },
      async (request) => {
        const { validFrom, validUntil, ...changes } = request.body;
        await deps.updateQrCode.execute(
          {
            id: request.params.id,
            changes: { ...changes, validFrom: toDate(validFrom), validUntil: toDate(validUntil) },
          },
          staffOf(request),
        );
        return qrCode(request.params.id);
      },
    );

    /* Selos conquistados */

    r.route(
      ROUTES.earnedSeals.list,
      { querystring: listEarnedSealsQuerySchema, response: { 200: earnedSealPageSchema } },
      async (request) => queries.listEarnedSeals(request.query),
    );
  };
}

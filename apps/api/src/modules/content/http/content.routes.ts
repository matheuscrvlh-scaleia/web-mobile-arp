import {
  App,
  artPointListSchema,
  artPointSchema,
  contentPageKeyParamsSchema,
  contentPageListSchema,
  contentPageSchema,
  createArtPointBodySchema,
  createJobBodySchema,
  createRecyclingItemBodySchema,
  idParamsSchema,
  jobListSchema,
  jobSchema,
  listJobsQuerySchema,
  ROUTES,
  recyclingItemListSchema,
  recyclingItemSchema,
  updateArtPointBodySchema,
  updateContentPageBodySchema,
  updateRecyclingItemBodySchema,
} from "@arp/contracts";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { APP_CONTENT_CACHE_PREFIX } from "../../../shared/application/ports/cache";
import type { Clock } from "../../../shared/application/ports/clock";
import { scopedStoreId } from "../../../shared/application/store-scope";
import { orNotFound } from "../../../shared/domain/errors";
import { staffOf } from "../../../shared/infra/http/auth";
import { createRouter } from "../../../shared/infra/http/router";
import type { CreateCatalogItemUseCase } from "../../directory/application/create-catalog-item.use-case";
import type { DeleteCatalogItemUseCase } from "../../directory/application/delete-catalog-item.use-case";
import type { UpdateCatalogItemUseCase } from "../../directory/application/update-catalog-item.use-case";
import {
  type CreateJobUseCase,
  JOB_NOT_FOUND,
  type RemoveJobUseCase,
  type UpdateContentPageUseCase,
} from "../application/content.use-cases";
import type { ArtPointProps, RecyclingItemProps } from "../domain/content";
import type { ContentQueries } from "../infra/content.queries";

interface Commands<P extends { id: string }> {
  create: CreateCatalogItemUseCase<P>;
  update: UpdateCatalogItemUseCase<P>;
  remove: DeleteCatalogItemUseCase<P>;
}

export interface ContentRoutesDeps {
  queries: ContentQueries;
  clock: Clock;
  updatePage: UpdateContentPageUseCase;
  artPoints: Commands<ArtPointProps>;
  recyclingItems: Commands<RecyclingItemProps>;
  createJob: CreateJobUseCase;
  removeJob: RemoveJobUseCase;
}

export const ART_POINT_NOT_FOUND = "Ponto do Circuito não encontrado";
export const RECYCLING_ITEM_NOT_FOUND = "Item do Sustentarp não encontrado";

/** Painel: textos, Circuito Cultural, Sustentarp e vagas. */
export function contentRoutes(deps: ContentRoutesDeps): FastifyPluginAsyncZod {
  const { queries, clock } = deps;
  const artPoint = async (id: string) =>
    orNotFound((await queries.artPoints({ id }))[0], ART_POINT_NOT_FOUND);
  const recyclingItem = async (id: string) =>
    orNotFound((await queries.recyclingItems({ id }))[0], RECYCLING_ITEM_NOT_FOUND);

  return async (app) => {
    const r = createRouter(app, {
      audience: "admin",
      tag: "Conteúdo",
      // Escrita aqui muda o que o app mostra: limpa as leituras compartilhadas.
      invalidates: [APP_CONTENT_CACHE_PREFIX],
    });

    /* Textos */
    r.route(ROUTES.contentPages.list, { response: { 200: contentPageListSchema } }, async () => ({
      data: await queries.pages(),
    }));
    r.route(
      ROUTES.contentPages.update,
      {
        params: contentPageKeyParamsSchema,
        body: updateContentPageBodySchema,
        response: { 200: contentPageSchema },
      },
      async (request) => {
        const { key } = request.params;
        await deps.updatePage.execute({ key, changes: request.body }, staffOf(request));
        return queries.page(key);
      },
    );

    /* Circuito Cultural */
    r.route(ROUTES.artPoints.list, { response: { 200: artPointListSchema } }, async () => ({
      data: await queries.artPoints(),
    }));
    r.route(
      ROUTES.artPoints.create,
      { body: createArtPointBodySchema, response: { 201: artPointSchema } },
      async (request, reply) => {
        const id = await deps.artPoints.create.execute(request.body, staffOf(request));
        return reply.status(201).send(await artPoint(id));
      },
    );
    r.route(
      ROUTES.artPoints.update,
      { params: idParamsSchema, body: updateArtPointBodySchema, response: { 200: artPointSchema } },
      async (request) => {
        await deps.artPoints.update.execute(
          { id: request.params.id, changes: request.body },
          staffOf(request),
        );
        return artPoint(request.params.id);
      },
    );
    r.route(ROUTES.artPoints.remove, { params: idParamsSchema }, async (request, reply) => {
      await deps.artPoints.remove.execute(request.params, staffOf(request));
      return reply.status(204).send();
    });

    /* Sustentarp */
    r.route(
      ROUTES.recyclingItems.list,
      { response: { 200: recyclingItemListSchema } },
      async () => ({ data: await queries.recyclingItems() }),
    );
    r.route(
      ROUTES.recyclingItems.create,
      { body: createRecyclingItemBodySchema, response: { 201: recyclingItemSchema } },
      async (request, reply) => {
        const id = await deps.recyclingItems.create.execute(request.body, staffOf(request));
        return reply.status(201).send(await recyclingItem(id));
      },
    );
    r.route(
      ROUTES.recyclingItems.update,
      {
        params: idParamsSchema,
        body: updateRecyclingItemBodySchema,
        response: { 200: recyclingItemSchema },
      },
      async (request) => {
        await deps.recyclingItems.update.execute(
          { id: request.params.id, changes: request.body },
          staffOf(request),
        );
        return recyclingItem(request.params.id);
      },
    );
    r.route(ROUTES.recyclingItems.remove, { params: idParamsSchema }, async (request, reply) => {
      await deps.recyclingItems.remove.execute(request.params, staffOf(request));
      return reply.status(204).send();
    });

    /* Vagas (lojista: só as da loja dele) */
    r.route(
      ROUTES.jobs.list,
      { querystring: listJobsQuerySchema, response: { 200: jobListSchema } },
      async (request) => {
        const storeId = scopedStoreId(staffOf(request), request.query.storeId);
        const query = { ...request.query, ...(storeId ? { storeId } : {}) };
        return { data: await queries.jobs(query, clock.now()) };
      },
    );
    r.route(
      ROUTES.jobs.create,
      { body: createJobBodySchema, response: { 201: jobSchema } },
      async (request, reply) => {
        const id = await deps.createJob.execute(request.body, staffOf(request));
        const [job] = await queries.jobs({ id }, clock.now());
        return reply.status(201).send(orNotFound(job, JOB_NOT_FOUND));
      },
    );
    r.route(ROUTES.jobs.remove, { params: idParamsSchema }, async (request, reply) => {
      await deps.removeJob.execute(request.params, staffOf(request));
      return reply.status(204).send();
    });
  };
}

const { APP_ROUTES } = App;

/** App: leitura pública do conteúdo (registrada sob /app). */
export function appContentRoutes(
  deps: Pick<ContentRoutesDeps, "queries" | "clock">,
): FastifyPluginAsyncZod {
  const { queries, clock } = deps;
  return async (app) => {
    const r = createRouter(app, { audience: "app", tag: "App: conteúdo" });
    r.route(
      APP_ROUTES.content.page,
      { params: contentPageKeyParamsSchema, response: { 200: contentPageSchema } },
      async (request) => queries.page(request.params.key),
    );
    r.route(APP_ROUTES.content.artPoints, { response: { 200: artPointListSchema } }, async () => ({
      data: await queries.artPoints({ onlyActive: true }),
    }));
    r.route(
      APP_ROUTES.content.recycling,
      { response: { 200: recyclingItemListSchema } },
      async () => ({ data: await queries.recyclingItems({ onlyActive: true }) }),
    );
    r.route(APP_ROUTES.content.jobs, { response: { 200: jobListSchema } }, async () => ({
      data: await queries.jobs({ status: "live" }, clock.now()),
    }));
  };
}

import {
  blockListSchema,
  blockSchema,
  createBlockBodySchema,
  createFloorBodySchema,
  createMapPointBodySchema,
  createStoreBodySchema,
  createStoreCategoryBodySchema,
  floorListSchema,
  floorSchema,
  idParamsSchema,
  listMapPointsQuerySchema,
  listStoresQuerySchema,
  mapPointListSchema,
  mapPointSchema,
  ROUTES,
  storeCategoryListSchema,
  storeCategorySchema,
  storeDetailSchema,
  storeMetricsQuerySchema,
  storeMetricsSchema,
  storeOptionListSchema,
  storePageSchema,
  storePinListSchema,
  updateBlockBodySchema,
  updateFloorBodySchema,
  updateMapPointBodySchema,
  updateStoreBodySchema,
  updateStoreCategoryBodySchema,
  updateStoreLocationBodySchema,
} from "@arp/contracts";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { APP_CONTENT_CACHE_PREFIX } from "../../../shared/application/ports/cache";
import { assertStoreAccess, scopedStoreId } from "../../../shared/application/store-scope";
import { orNotFound } from "../../../shared/domain/errors";
import { staffOf } from "../../../shared/infra/http/auth";
import { createRouter } from "../../../shared/infra/http/router";
import {
  BLOCK_NOT_FOUND,
  FLOOR_NOT_FOUND,
  MAP_POINT_NOT_FOUND,
  STORE_CATEGORY_NOT_FOUND,
} from "../application/catalog-deps";
import type { CreateCatalogItemUseCase } from "../application/create-catalog-item.use-case";
import type { CreateStoreUseCase } from "../application/create-store.use-case";
import type { DeactivateStoreUseCase } from "../application/deactivate-store.use-case";
import type { DeleteCatalogItemUseCase } from "../application/delete-catalog-item.use-case";
import type { LocateStoreUseCase } from "../application/locate-store.use-case";
import { STORE_NOT_FOUND } from "../application/store-deps";
import type { UpdateCatalogItemUseCase } from "../application/update-catalog-item.use-case";
import type { UpdateStoreUseCase } from "../application/update-store.use-case";
import type { BlockProps, FloorProps, MapPointProps, StoreCategoryProps } from "../domain/catalog";
import type { DirectoryQueries } from "../infra/directory.queries";

interface CatalogCommands<P extends { id: string }> {
  create: CreateCatalogItemUseCase<P>;
  update: UpdateCatalogItemUseCase<P>;
  remove: DeleteCatalogItemUseCase<P>;
}

export interface DirectoryRoutesDeps {
  queries: DirectoryQueries;
  floors: CatalogCommands<FloorProps>;
  blocks: CatalogCommands<BlockProps>;
  categories: CatalogCommands<StoreCategoryProps>;
  mapPoints: CatalogCommands<MapPointProps>;
  createStore: CreateStoreUseCase;
  updateStore: UpdateStoreUseCase;
  deactivateStore: DeactivateStoreUseCase;
  locateStore: LocateStoreUseCase;
}

export function directoryRoutes(deps: DirectoryRoutesDeps): FastifyPluginAsyncZod {
  const { queries } = deps;
  const floor = async (id: string) =>
    orNotFound((await queries.listFloors(id))[0], FLOOR_NOT_FOUND);
  const block = async (id: string) =>
    orNotFound((await queries.listBlocks(id))[0], BLOCK_NOT_FOUND);
  const category = async (id: string) =>
    orNotFound((await queries.listStoreCategories(id))[0], STORE_CATEGORY_NOT_FOUND);
  const mapPoint = async (id: string) =>
    orNotFound((await queries.listMapPoints({ id }))[0], MAP_POINT_NOT_FOUND);
  const store = async (id: string) => orNotFound(await queries.getStore(id), STORE_NOT_FOUND);

  return async (app) => {
    const r = createRouter(app, {
      audience: "admin",
      tag: "Lojas e mapa",
      // Escrita aqui muda o que o app mostra: limpa as leituras compartilhadas.
      invalidates: [APP_CONTENT_CACHE_PREFIX],
    });

    /* Andares */
    r.route(ROUTES.floors.list, { response: { 200: floorListSchema } }, async () => ({
      data: await queries.listFloors(),
    }));
    r.route(
      ROUTES.floors.pins,
      { params: idParamsSchema, response: { 200: storePinListSchema } },
      async (request) => {
        const storeId = scopedStoreId(staffOf(request), undefined);
        const pins = await queries.listStorePins(request.params.id, storeId);
        return { data: orNotFound(pins, FLOOR_NOT_FOUND) };
      },
    );
    r.route(
      ROUTES.floors.create,
      { body: createFloorBodySchema, response: { 201: floorSchema } },
      async (request, reply) => {
        const id = await deps.floors.create.execute(request.body, staffOf(request));
        return reply.status(201).send(await floor(id));
      },
    );
    r.route(
      ROUTES.floors.update,
      { params: idParamsSchema, body: updateFloorBodySchema, response: { 200: floorSchema } },
      async (request) => {
        await deps.floors.update.execute(
          { id: request.params.id, changes: request.body },
          staffOf(request),
        );
        return floor(request.params.id);
      },
    );
    r.route(ROUTES.floors.remove, { params: idParamsSchema }, async (request, reply) => {
      await deps.floors.remove.execute(request.params, staffOf(request));
      return reply.status(204).send();
    });

    /* Blocos */
    r.route(ROUTES.blocks.list, { response: { 200: blockListSchema } }, async () => ({
      data: await queries.listBlocks(),
    }));
    r.route(
      ROUTES.blocks.create,
      { body: createBlockBodySchema, response: { 201: blockSchema } },
      async (request, reply) => {
        const id = await deps.blocks.create.execute(request.body, staffOf(request));
        return reply.status(201).send(await block(id));
      },
    );
    r.route(
      ROUTES.blocks.update,
      { params: idParamsSchema, body: updateBlockBodySchema, response: { 200: blockSchema } },
      async (request) => {
        await deps.blocks.update.execute(
          { id: request.params.id, changes: request.body },
          staffOf(request),
        );
        return block(request.params.id);
      },
    );
    r.route(ROUTES.blocks.remove, { params: idParamsSchema }, async (request, reply) => {
      await deps.blocks.remove.execute(request.params, staffOf(request));
      return reply.status(204).send();
    });

    /* Pontos do mapa */
    r.route(
      ROUTES.mapPoints.list,
      { querystring: listMapPointsQuerySchema, response: { 200: mapPointListSchema } },
      async (request) => ({ data: await queries.listMapPoints(request.query) }),
    );
    r.route(
      ROUTES.mapPoints.create,
      { body: createMapPointBodySchema, response: { 201: mapPointSchema } },
      async (request, reply) => {
        const id = await deps.mapPoints.create.execute(request.body, staffOf(request));
        return reply.status(201).send(await mapPoint(id));
      },
    );
    r.route(
      ROUTES.mapPoints.update,
      { params: idParamsSchema, body: updateMapPointBodySchema, response: { 200: mapPointSchema } },
      async (request) => {
        await deps.mapPoints.update.execute(
          { id: request.params.id, changes: request.body },
          staffOf(request),
        );
        return mapPoint(request.params.id);
      },
    );
    r.route(ROUTES.mapPoints.remove, { params: idParamsSchema }, async (request, reply) => {
      await deps.mapPoints.remove.execute(request.params, staffOf(request));
      return reply.status(204).send();
    });

    /* Categorias de loja */
    r.route(
      ROUTES.storeCategories.list,
      { response: { 200: storeCategoryListSchema } },
      async () => ({
        data: await queries.listStoreCategories(),
      }),
    );
    r.route(
      ROUTES.storeCategories.create,
      { body: createStoreCategoryBodySchema, response: { 201: storeCategorySchema } },
      async (request, reply) => {
        const id = await deps.categories.create.execute(request.body, staffOf(request));
        return reply.status(201).send(await category(id));
      },
    );
    r.route(
      ROUTES.storeCategories.update,
      {
        params: idParamsSchema,
        body: updateStoreCategoryBodySchema,
        response: { 200: storeCategorySchema },
      },
      async (request) => {
        await deps.categories.update.execute(
          { id: request.params.id, changes: request.body },
          staffOf(request),
        );
        return category(request.params.id);
      },
    );
    r.route(ROUTES.storeCategories.remove, { params: idParamsSchema }, async (request, reply) => {
      await deps.categories.remove.execute(request.params, staffOf(request));
      return reply.status(204).send();
    });

    /* Lojas */
    r.route(
      ROUTES.stores.list,
      { querystring: listStoresQuerySchema, response: { 200: storePageSchema } },
      async (request) =>
        queries.listStores(request.query, scopedStoreId(staffOf(request), undefined)),
    );
    r.route(ROUTES.stores.options, { response: { 200: storeOptionListSchema } }, async () => ({
      data: await queries.storeOptions(),
    }));
    r.route(
      ROUTES.stores.get,
      { params: idParamsSchema, response: { 200: storeDetailSchema } },
      async (request) => {
        assertStoreAccess(staffOf(request), request.params.id);
        return store(request.params.id);
      },
    );
    r.route(
      ROUTES.stores.create,
      { body: createStoreBodySchema, response: { 201: storeDetailSchema } },
      async (request, reply) => {
        const id = await deps.createStore.execute(request.body, staffOf(request));
        return reply.status(201).send(await store(id));
      },
    );
    r.route(
      ROUTES.stores.update,
      { params: idParamsSchema, body: updateStoreBodySchema, response: { 200: storeDetailSchema } },
      async (request) => {
        await deps.updateStore.execute(
          { id: request.params.id, changes: request.body },
          staffOf(request),
        );
        return store(request.params.id);
      },
    );
    r.route(
      ROUTES.stores.updateLocation,
      {
        params: idParamsSchema,
        body: updateStoreLocationBodySchema,
        response: { 200: storeDetailSchema },
      },
      async (request) => {
        await deps.locateStore.execute(
          {
            id: request.params.id,
            mapX: request.body.mapX,
            mapY: request.body.mapY,
            ...(request.body.floorId ? { floorId: request.body.floorId } : {}),
          },
          staffOf(request),
        );
        return store(request.params.id);
      },
    );
    r.route(ROUTES.stores.remove, { params: idParamsSchema }, async (request, reply) => {
      await deps.deactivateStore.execute(request.params, staffOf(request));
      return reply.status(204).send();
    });
    r.route(
      ROUTES.stores.metrics,
      {
        params: idParamsSchema,
        querystring: storeMetricsQuerySchema,
        response: { 200: storeMetricsSchema },
      },
      async (request) => {
        assertStoreAccess(staffOf(request), request.params.id);
        await store(request.params.id);
        return queries.storeMetrics(request.params.id, request.query.period);
      },
    );
  };
}

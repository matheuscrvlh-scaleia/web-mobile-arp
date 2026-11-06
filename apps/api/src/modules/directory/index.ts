import type { CoreDeps } from "../../shared/infra/core";
import { createImageCleanup } from "../../shared/infra/images";
import { BulkUpdateStoresUseCase } from "./application/bulk-update-stores.use-case";
import {
  BLOCK_NOT_FOUND,
  type CatalogDeps,
  FLOOR_NOT_FOUND,
  MAP_POINT_NOT_FOUND,
  STORE_CATEGORY_NOT_FOUND,
} from "./application/catalog-deps";
import { CreateCatalogItemUseCase } from "./application/create-catalog-item.use-case";
import { CreateStoreUseCase } from "./application/create-store.use-case";
import { DeactivateStoreUseCase } from "./application/deactivate-store.use-case";
import { DeleteCatalogItemUseCase } from "./application/delete-catalog-item.use-case";
import { DeleteStoreUseCase } from "./application/delete-store.use-case";
import { LocateStoreUseCase } from "./application/locate-store.use-case";
import { ReorderCatalogUseCase } from "./application/reorder-catalog.use-case";
import type { StoreUseCaseDeps } from "./application/store-deps";
import { UpdateCatalogItemUseCase } from "./application/update-catalog-item.use-case";
import { UpdateStoreUseCase } from "./application/update-store.use-case";
import { directoryRoutes } from "./http/directory.routes";
import { DirectoryQueries } from "./infra/directory.queries";
import {
  blockRepository,
  floorRepository,
  mapPointRepository,
  PgDirectoryReferences,
  PgStoreRepository,
  storeCategoryRepository,
} from "./infra/pg-directory-repositories";

function commands<P extends { id: string }>(deps: CatalogDeps<P>) {
  return {
    create: new CreateCatalogItemUseCase(deps),
    update: new UpdateCatalogItemUseCase(deps),
    remove: new DeleteCatalogItemUseCase(deps),
    reorder: new ReorderCatalogUseCase(deps),
  };
}

export function createDirectoryModule(core: CoreDeps) {
  const { db, uow, audit, clock } = core;
  const queries = new DirectoryQueries(db, clock);
  const storeDeps: StoreUseCaseDeps = {
    stores: new PgStoreRepository(db),
    references: new PgDirectoryReferences(db),
    audit,
    uow,
    images: createImageCleanup(core),
  };

  const routes = directoryRoutes({
    queries,
    floors: commands({
      entityType: "floor",
      notFoundMessage: FLOOR_NOT_FOUND,
      repository: floorRepository(db),
      audit,
      uow,
    }),
    blocks: commands({
      entityType: "block",
      notFoundMessage: BLOCK_NOT_FOUND,
      repository: blockRepository(db),
      audit,
      uow,
    }),
    categories: commands({
      entityType: "store_category",
      notFoundMessage: STORE_CATEGORY_NOT_FOUND,
      repository: storeCategoryRepository(db),
      audit,
      uow,
    }),
    mapPoints: commands({
      entityType: "map_point",
      notFoundMessage: MAP_POINT_NOT_FOUND,
      repository: mapPointRepository(db),
      audit,
      uow,
    }),
    createStore: new CreateStoreUseCase(storeDeps),
    updateStore: new UpdateStoreUseCase(storeDeps),
    bulkUpdateStores: new BulkUpdateStoresUseCase(storeDeps),
    deactivateStore: new DeactivateStoreUseCase(storeDeps),
    deleteStore: new DeleteStoreUseCase(storeDeps),
    locateStore: new LocateStoreUseCase(storeDeps),
  });

  return { routes };
}

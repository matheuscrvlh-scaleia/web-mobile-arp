import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { CoreDeps } from "../../shared/infra/core";
import type { CatalogDeps } from "../directory/application/catalog-deps";
import { CreateCatalogItemUseCase } from "../directory/application/create-catalog-item.use-case";
import { DeleteCatalogItemUseCase } from "../directory/application/delete-catalog-item.use-case";
import { UpdateCatalogItemUseCase } from "../directory/application/update-catalog-item.use-case";
import {
  CreateJobUseCase,
  RemoveJobUseCase,
  UpdateContentPageUseCase,
  UpdateJobUseCase,
} from "./application/content.use-cases";
import {
  ART_POINT_NOT_FOUND,
  appContentRoutes,
  contentRoutes,
  RECYCLING_ITEM_NOT_FOUND,
} from "./http/content.routes";
import { ContentQueries } from "./infra/content.queries";
import {
  artPointRepository,
  jobRepository,
  PgContentPages,
  recyclingItemRepository,
} from "./infra/pg-content-repositories";

function commands<P extends { id: string }>(deps: CatalogDeps<P>) {
  return {
    create: new CreateCatalogItemUseCase(deps),
    update: new UpdateCatalogItemUseCase(deps),
    remove: new DeleteCatalogItemUseCase(deps),
  };
}

/** Conteúdo da ARP (Fase 2): textos, Circuito Cultural, Sustentarp e vagas. */
export function createContentModule(core: CoreDeps) {
  const { db, uow, audit, clock } = core;
  const queries = new ContentQueries(db);
  const jobDeps = {
    jobs: jobRepository(db),
    clock,
    audit,
    uow,
  };

  const panel = contentRoutes({
    queries,
    clock,
    updatePage: new UpdateContentPageUseCase({ pages: new PgContentPages(db), audit, uow }),
    artPoints: commands({
      entityType: "art_point",
      notFoundMessage: ART_POINT_NOT_FOUND,
      repository: artPointRepository(db),
      audit,
      uow,
    }),
    recyclingItems: commands({
      entityType: "recycling_item",
      notFoundMessage: RECYCLING_ITEM_NOT_FOUND,
      repository: recyclingItemRepository(db),
      audit,
      uow,
    }),
    createJob: new CreateJobUseCase(jobDeps),
    updateJob: new UpdateJobUseCase(jobDeps),
    removeJob: new RemoveJobUseCase(jobDeps),
  });
  const app = appContentRoutes({ queries, clock });

  const routes: FastifyPluginAsyncZod = async (api) => {
    await api.register(panel);
    await api.register(app, { prefix: "/app" });
  };
  return { routes };
}

import type { CoreDeps } from "../../shared/infra/core";
import { createImageCleanup } from "../../shared/infra/images";
import { CreateEventUseCase } from "./application/create-event.use-case";
import { CreateEventCategoryUseCase } from "./application/create-event-category.use-case";
import { DeleteEventUseCase } from "./application/delete-event.use-case";
import { DeleteEventCategoryUseCase } from "./application/delete-event-category.use-case";
import { UpdateEventUseCase } from "./application/update-event.use-case";
import { UpdateEventCategoryUseCase } from "./application/update-event-category.use-case";
import { agendaRoutes } from "./http/agenda.routes";
import { AgendaQueries } from "./infra/agenda.queries";
import {
  PgAgendaEventRepository,
  PgAgendaReferences,
  PgEventCategoryRepository,
} from "./infra/pg-agenda-repositories";

export function createAgendaModule(core: CoreDeps) {
  const { db, uow, audit } = core;
  const queries = new AgendaQueries(db);
  const categoryDeps = { categories: new PgEventCategoryRepository(db), audit, uow };
  const eventDeps = {
    events: new PgAgendaEventRepository(db),
    references: new PgAgendaReferences(db),
    audit,
    uow,
    images: createImageCleanup(core),
  };

  const routes = agendaRoutes({
    queries,
    createCategory: new CreateEventCategoryUseCase(categoryDeps),
    updateCategory: new UpdateEventCategoryUseCase(categoryDeps),
    deleteCategory: new DeleteEventCategoryUseCase(categoryDeps),
    createEvent: new CreateEventUseCase(eventDeps),
    updateEvent: new UpdateEventUseCase(eventDeps),
    deleteEvent: new DeleteEventUseCase(eventDeps),
  });

  return { routes };
}

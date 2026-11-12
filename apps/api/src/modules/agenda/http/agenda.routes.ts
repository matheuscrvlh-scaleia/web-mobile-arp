import {
  type CreateEventBody,
  createEventBodySchema,
  createEventCategoryBodySchema,
  eventCategoryListSchema,
  eventCategorySchema,
  eventOccurrencesQuerySchema,
  eventOccurrencesSchema,
  eventPageSchema,
  eventSchema,
  idParamsSchema,
  listEventsQuerySchema,
  postponeEventBodySchema,
  ROUTES,
  syncSiteEventsBodySchema,
  syncSiteEventsResultSchema,
  type UpdateEventBody,
  updateEventBodySchema,
  updateEventCategoryBodySchema,
} from "@arp/contracts";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { APP_CONTENT_CACHE_PREFIX } from "../../../shared/application/ports/cache";
import { orNotFound } from "../../../shared/domain/errors";
import { staffOf } from "../../../shared/infra/http/auth";
import { createRouter } from "../../../shared/infra/http/router";
import { CATEGORY_NOT_FOUND, EVENT_NOT_FOUND } from "../application/agenda-deps";
import type { CreateEventUseCase } from "../application/create-event.use-case";
import type { CreateEventCategoryUseCase } from "../application/create-event-category.use-case";
import type { DeleteEventUseCase } from "../application/delete-event.use-case";
import type { DeleteEventCategoryUseCase } from "../application/delete-event-category.use-case";
import type { EventLifecycleUseCase } from "../application/event-lifecycle.use-case";
import type { SyncSiteEventsUseCase } from "../application/sync-site-events.use-case";
import type { UpdateEventUseCase } from "../application/update-event.use-case";
import type { UpdateEventCategoryUseCase } from "../application/update-event-category.use-case";
import type { AgendaEventChanges, NewAgendaEvent } from "../domain/agenda-event";
import type { AgendaQueries } from "../infra/agenda.queries";

export interface AgendaRoutesDeps {
  queries: AgendaQueries;
  createCategory: CreateEventCategoryUseCase;
  updateCategory: UpdateEventCategoryUseCase;
  deleteCategory: DeleteEventCategoryUseCase;
  createEvent: CreateEventUseCase;
  updateEvent: UpdateEventUseCase;
  deleteEvent: DeleteEventUseCase;
  lifecycle: EventLifecycleUseCase;
  syncSiteEvents: SyncSiteEventsUseCase;
}

/** weekdays (novo) ou weekday (cliente antigo, um dia só). undefined = não mexe. */
function weekdaysOf(body: { weekday?: number | null; weekdays?: number[] | null }) {
  if (body.weekdays !== undefined) return body.weekdays;
  if (body.weekday === undefined) return undefined;
  return body.weekday === null ? null : [body.weekday];
}

function toEventChanges(body: UpdateEventBody): AgendaEventChanges {
  const { weekday: _legacy, weekdays: _days, ...rest } = body;
  const weekdays = weekdaysOf(body);
  return weekdays === undefined ? rest : { ...rest, weekdays };
}

function toNewEvent(body: CreateEventBody): NewAgendaEvent {
  return {
    title: body.title,
    categoryId: body.categoryId,
    description: body.description,
    imageUrl: body.imageUrl ?? null,
    tone: body.tone ?? null,
    icon: body.icon ?? null,
    place: body.place,
    floorId: body.floorId ?? null,
    storeId: body.storeId ?? null,
    recurrence: body.recurrence,
    startsOn: body.startsOn,
    endsOn: body.endsOn ?? null,
    weekdays: weekdaysOf(body) ?? null,
    periods: body.periods ?? null,
    startTime: body.startTime ?? null,
    endTime: body.endTime ?? null,
    isLongRunning: body.isLongRunning,
    awardsSeal: body.awardsSeal,
    ticketUrl: body.ticketUrl ?? null,
    status: body.status,
  };
}

export function agendaRoutes(deps: AgendaRoutesDeps): FastifyPluginAsyncZod {
  const { queries } = deps;
  const category = async (id: string) =>
    orNotFound(await queries.getCategory(id), CATEGORY_NOT_FOUND);
  const event = async (id: string) => orNotFound(await queries.getEvent(id), EVENT_NOT_FOUND);

  return async (app) => {
    const r = createRouter(app, {
      audience: "admin",
      tag: "Agenda",
      // Escrita aqui muda o que o app mostra: limpa as leituras compartilhadas.
      invalidates: [APP_CONTENT_CACHE_PREFIX],
    });

    r.route(
      ROUTES.eventCategories.list,
      { response: { 200: eventCategoryListSchema } },
      async () => ({
        data: await queries.listCategories(),
      }),
    );

    r.route(
      ROUTES.eventCategories.create,
      { body: createEventCategoryBodySchema, response: { 201: eventCategorySchema } },
      async (request, reply) => {
        const id = await deps.createCategory.execute(request.body, staffOf(request));
        return reply.status(201).send(await category(id));
      },
    );

    r.route(
      ROUTES.eventCategories.update,
      {
        params: idParamsSchema,
        body: updateEventCategoryBodySchema,
        response: { 200: eventCategorySchema },
      },
      async (request) => {
        await deps.updateCategory.execute(
          { id: request.params.id, changes: request.body },
          staffOf(request),
        );
        return category(request.params.id);
      },
    );

    r.route(ROUTES.eventCategories.remove, { params: idParamsSchema }, async (request, reply) => {
      await deps.deleteCategory.execute({ id: request.params.id }, staffOf(request));
      return reply.status(204).send();
    });

    r.route(
      ROUTES.events.list,
      { querystring: listEventsQuerySchema, response: { 200: eventPageSchema } },
      async (request) => queries.listEvents(request.query),
    );

    r.route(
      ROUTES.events.occurrences,
      { querystring: eventOccurrencesQuerySchema, response: { 200: eventOccurrencesSchema } },
      async (request) => queries.occurrences(request.query.from, request.query.to),
    );

    r.route(
      ROUTES.events.get,
      { params: idParamsSchema, response: { 200: eventSchema } },
      async (request) => event(request.params.id),
    );

    r.route(
      ROUTES.events.create,
      { body: createEventBodySchema, response: { 201: eventSchema } },
      async (request, reply) => {
        const id = await deps.createEvent.execute(toNewEvent(request.body), staffOf(request));
        return reply.status(201).send(await event(id));
      },
    );

    r.route(
      ROUTES.events.update,
      { params: idParamsSchema, body: updateEventBodySchema, response: { 200: eventSchema } },
      async (request) => {
        await deps.updateEvent.execute(
          { id: request.params.id, changes: toEventChanges(request.body) },
          staffOf(request),
        );
        return event(request.params.id);
      },
    );

    r.route(
      ROUTES.events.archive,
      { params: idParamsSchema, response: { 200: eventSchema } },
      async (request) => {
        await deps.lifecycle.execute(
          { id: request.params.id, action: { type: "archive" } },
          staffOf(request),
        );
        return event(request.params.id);
      },
    );

    r.route(
      ROUTES.events.unarchive,
      { params: idParamsSchema, response: { 200: eventSchema } },
      async (request) => {
        await deps.lifecycle.execute(
          { id: request.params.id, action: { type: "unarchive" } },
          staffOf(request),
        );
        return event(request.params.id);
      },
    );

    r.route(
      ROUTES.events.postpone,
      { params: idParamsSchema, body: postponeEventBodySchema, response: { 200: eventSchema } },
      async (request) => {
        await deps.lifecycle.execute(
          { id: request.params.id, action: { type: "postpone", startsOn: request.body.startsOn } },
          staffOf(request),
        );
        return event(request.params.id);
      },
    );

    r.route(
      ROUTES.events.syncSite,
      { body: syncSiteEventsBodySchema, response: { 200: syncSiteEventsResultSchema } },
      async (request) => deps.syncSiteEvents.execute(request.body, staffOf(request)),
    );

    r.route(ROUTES.events.remove, { params: idParamsSchema }, async (request, reply) => {
      await deps.deleteEvent.execute({ id: request.params.id }, staffOf(request));
      return reply.status(204).send();
    });
  };
}

import {
  audienceEstimateQuerySchema,
  audienceEstimateSchema,
  type CreateHighlightBody,
  createHighlightBodySchema,
  createNotificationBodySchema,
  highlightListSchema,
  highlightSchema,
  idParamsSchema,
  listHighlightsQuerySchema,
  listNotificationsQuerySchema,
  pushNotificationPageSchema,
  pushNotificationSchema,
  ROUTES,
  reorderHighlightsBodySchema,
  scheduleNotificationBodySchema,
  type UpdateHighlightBody,
  updateHighlightBodySchema,
  updateNotificationBodySchema,
} from "@arp/contracts";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { APP_CONTENT_CACHE_PREFIX } from "../../../shared/application/ports/cache";
import type { Clock } from "../../../shared/application/ports/clock";
import { orNotFound } from "../../../shared/domain/errors";
import { staffOf } from "../../../shared/infra/http/auth";
import { createRouter } from "../../../shared/infra/http/router";
import { toDate } from "../../../shared/infra/presenters";
import type { CancelNotificationUseCase } from "../application/cancel-notification.use-case";
import type { CreateHighlightUseCase } from "../application/create-highlight.use-case";
import type { CreateNotificationUseCase } from "../application/create-notification.use-case";
import type { DeleteHighlightUseCase } from "../application/delete-highlight.use-case";
import { HIGHLIGHT_NOT_FOUND, NOTIFICATION_NOT_FOUND } from "../application/marketing-deps";
import type {
  DeleteNotificationUseCase,
  NotificationBackToDraftUseCase,
} from "../application/notification-draft.use-case";
import type { ReorderHighlightsUseCase } from "../application/reorder-highlights.use-case";
import type { ScheduleNotificationUseCase } from "../application/schedule-notification.use-case";
import type { UpdateHighlightUseCase } from "../application/update-highlight.use-case";
import type { UpdateNotificationUseCase } from "../application/update-notification.use-case";
import type { HighlightChanges, NewHighlight } from "../domain/highlight";
import type { MarketingQueries } from "../infra/marketing.queries";

export interface MarketingRoutesDeps {
  queries: MarketingQueries;
  clock: Clock;
  createHighlight: CreateHighlightUseCase;
  updateHighlight: UpdateHighlightUseCase;
  reorderHighlights: ReorderHighlightsUseCase;
  deleteHighlight: DeleteHighlightUseCase;
  createNotification: CreateNotificationUseCase;
  updateNotification: UpdateNotificationUseCase;
  scheduleNotification: ScheduleNotificationUseCase;
  cancelNotification: CancelNotificationUseCase;
  notificationToDraft: NotificationBackToDraftUseCase;
  deleteNotification: DeleteNotificationUseCase;
}

function toNewHighlight(body: CreateHighlightBody): NewHighlight {
  return {
    title: body.title,
    subtitle: body.subtitle ?? null,
    ctaLabel: body.ctaLabel ?? null,
    imageUrl: body.imageUrl ?? null,
    badge: body.badge,
    targetType: body.targetType,
    targetId: body.targetId ?? null,
    targetUrl: body.targetUrl ?? null,
    sponsorStoreId: body.sponsorStoreId ?? null,
    startsAt: toDate(body.startsAt),
    endsAt: toDate(body.endsAt),
    status: body.status,
  };
}

function toHighlightChanges(body: UpdateHighlightBody): HighlightChanges {
  const { startsAt, endsAt, ...rest } = body;
  return { ...rest, startsAt: toDate(startsAt), endsAt: toDate(endsAt) };
}

export function marketingRoutes(deps: MarketingRoutesDeps): FastifyPluginAsyncZod {
  const { queries, clock } = deps;
  const highlight = async (id: string) =>
    orNotFound(await queries.getHighlight(id, clock.now()), HIGHLIGHT_NOT_FOUND);
  const notification = async (id: string) =>
    orNotFound(await queries.getNotification(id), NOTIFICATION_NOT_FOUND);

  return async (app) => {
    const r = createRouter(app, {
      audience: "admin",
      tag: "Comunicação",
      // Escrita aqui muda o que o app mostra: limpa as leituras compartilhadas.
      invalidates: [APP_CONTENT_CACHE_PREFIX],
    });

    r.route(
      ROUTES.highlights.list,
      { querystring: listHighlightsQuerySchema, response: { 200: highlightListSchema } },
      async (request) => ({ data: await queries.listHighlights(request.query, clock.now()) }),
    );

    r.route(
      ROUTES.highlights.get,
      { params: idParamsSchema, response: { 200: highlightSchema } },
      async (request) => highlight(request.params.id),
    );

    r.route(
      ROUTES.highlights.create,
      { body: createHighlightBodySchema, response: { 201: highlightSchema } },
      async (request, reply) => {
        const id = await deps.createHighlight.execute(
          toNewHighlight(request.body),
          staffOf(request),
        );
        return reply.status(201).send(await highlight(id));
      },
    );

    r.route(
      ROUTES.highlights.reorder,
      { body: reorderHighlightsBodySchema },
      async (request, reply) => {
        await deps.reorderHighlights.execute(request.body, staffOf(request));
        return reply.status(204).send();
      },
    );

    r.route(
      ROUTES.highlights.update,
      {
        params: idParamsSchema,
        body: updateHighlightBodySchema,
        response: { 200: highlightSchema },
      },
      async (request) => {
        await deps.updateHighlight.execute(
          { id: request.params.id, changes: toHighlightChanges(request.body) },
          staffOf(request),
        );
        return highlight(request.params.id);
      },
    );

    r.route(ROUTES.highlights.remove, { params: idParamsSchema }, async (request, reply) => {
      await deps.deleteHighlight.execute({ id: request.params.id }, staffOf(request));
      return reply.status(204).send();
    });

    r.route(
      ROUTES.notifications.list,
      { querystring: listNotificationsQuerySchema, response: { 200: pushNotificationPageSchema } },
      async (request) => queries.listNotifications(request.query),
    );

    r.route(
      ROUTES.notifications.estimate,
      { querystring: audienceEstimateQuerySchema, response: { 200: audienceEstimateSchema } },
      async (request) => ({
        recipientsCount: await queries.estimate(
          request.query.audience,
          request.query.storeId,
          request.query.eventId,
        ),
      }),
    );

    r.route(
      ROUTES.notifications.get,
      { params: idParamsSchema, response: { 200: pushNotificationSchema } },
      async (request) => notification(request.params.id),
    );

    r.route(
      ROUTES.notifications.create,
      { body: createNotificationBodySchema, response: { 201: pushNotificationSchema } },
      async (request, reply) => {
        const { storeId, eventId, deepLink, ...content } = request.body;
        const id = await deps.createNotification.execute(
          {
            ...content,
            storeId: storeId ?? null,
            eventId: eventId ?? null,
            deepLink: deepLink || null,
          },
          staffOf(request),
        );
        return reply.status(201).send(await notification(id));
      },
    );

    r.route(
      ROUTES.notifications.update,
      {
        params: idParamsSchema,
        body: updateNotificationBodySchema,
        response: { 200: pushNotificationSchema },
      },
      async (request) => {
        const { deepLink, ...changes } = request.body;
        await deps.updateNotification.execute(
          {
            id: request.params.id,
            changes: deepLink === undefined ? changes : { ...changes, deepLink: deepLink || null },
          },
          staffOf(request),
        );
        return notification(request.params.id);
      },
    );

    r.route(
      ROUTES.notifications.schedule,
      {
        params: idParamsSchema,
        body: scheduleNotificationBodySchema,
        response: { 200: pushNotificationSchema },
      },
      async (request) => {
        await deps.scheduleNotification.execute(
          { id: request.params.id, scheduledAt: toDate(request.body.scheduledAt ?? null) },
          staffOf(request),
        );
        return notification(request.params.id);
      },
    );

    r.route(
      ROUTES.notifications.cancel,
      { params: idParamsSchema, response: { 200: pushNotificationSchema } },
      async (request) => {
        await deps.cancelNotification.execute({ id: request.params.id }, staffOf(request));
        return notification(request.params.id);
      },
    );

    r.route(
      ROUTES.notifications.toDraft,
      { params: idParamsSchema, response: { 200: pushNotificationSchema } },
      async (request) => {
        await deps.notificationToDraft.execute({ id: request.params.id }, staffOf(request));
        return notification(request.params.id);
      },
    );

    r.route(ROUTES.notifications.remove, { params: idParamsSchema }, async (request, reply) => {
      await deps.deleteNotification.execute({ id: request.params.id }, staffOf(request));
      return reply.status(204).send();
    });
  };
}

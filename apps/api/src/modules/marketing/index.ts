import type { CoreDeps } from "../../shared/infra/core";
import { createImageCleanup } from "../../shared/infra/images";
import type { Job } from "../../shared/infra/jobs/scheduler";
import { CancelNotificationUseCase } from "./application/cancel-notification.use-case";
import { CreateHighlightUseCase } from "./application/create-highlight.use-case";
import { CreateNotificationUseCase } from "./application/create-notification.use-case";
import { DeleteHighlightUseCase } from "./application/delete-highlight.use-case";
import {
  DeleteNotificationUseCase,
  NotificationBackToDraftUseCase,
} from "./application/notification-draft.use-case";
import { ReorderHighlightsUseCase } from "./application/reorder-highlights.use-case";
import { ScheduleNotificationUseCase } from "./application/schedule-notification.use-case";
import { SendDueNotificationsUseCase } from "./application/send-due-notifications.use-case";
import { UpdateHighlightUseCase } from "./application/update-highlight.use-case";
import { UpdateNotificationUseCase } from "./application/update-notification.use-case";
import { marketingRoutes } from "./http/marketing.routes";
import { MarketingQueries } from "./infra/marketing.queries";
import {
  PgAudienceDirectory,
  PgHighlightRepository,
  PgMarketingReferences,
  PgPushNotificationRepository,
} from "./infra/pg-marketing-repositories";

export function createMarketingModule(core: CoreDeps) {
  const { db, uow, audit, clock, push, logger } = core;
  const references = new PgMarketingReferences(db);
  const audience = new PgAudienceDirectory(db);
  const queries = new MarketingQueries(db, audience);
  const highlightDeps = {
    highlights: new PgHighlightRepository(db),
    references,
    audit,
    uow,
    images: createImageCleanup(core),
  };
  const notificationDeps = {
    notifications: new PgPushNotificationRepository(db),
    audience,
    references,
    push,
    clock,
    audit,
    uow,
  };
  const sendDue = new SendDueNotificationsUseCase(notificationDeps);

  const routes = marketingRoutes({
    queries,
    clock,
    createHighlight: new CreateHighlightUseCase(highlightDeps),
    updateHighlight: new UpdateHighlightUseCase(highlightDeps),
    reorderHighlights: new ReorderHighlightsUseCase(highlightDeps),
    deleteHighlight: new DeleteHighlightUseCase(highlightDeps),
    createNotification: new CreateNotificationUseCase(notificationDeps),
    updateNotification: new UpdateNotificationUseCase(notificationDeps),
    scheduleNotification: new ScheduleNotificationUseCase(notificationDeps),
    cancelNotification: new CancelNotificationUseCase(notificationDeps),
    notificationToDraft: new NotificationBackToDraftUseCase(notificationDeps),
    deleteNotification: new DeleteNotificationUseCase(notificationDeps),
  });

  const sendScheduledJob: Job = {
    name: "send-scheduled-notifications",
    intervalMs: 60_000,
    async run() {
      const sent = await sendDue.execute();
      if (sent > 0) logger.info({ sent }, "Notificações agendadas enviadas");
    },
  };

  return { routes, jobs: [sendScheduledJob] };
}

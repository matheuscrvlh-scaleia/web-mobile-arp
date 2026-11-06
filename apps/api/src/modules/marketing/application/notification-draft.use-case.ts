import type { StaffActor } from "../../../shared/application/actor";
import { snapshot } from "../../../shared/application/audit-changes";
import { NotFoundError } from "../../../shared/domain/errors";
import { NOTIFICATION_NOT_FOUND, type NotificationUseCaseDeps } from "./marketing-deps";

/** Cancelada volta para rascunho (editar e agendar de novo). */
export class NotificationBackToDraftUseCase {
  constructor(private readonly deps: NotificationUseCaseDeps) {}

  async execute(input: { id: string }, actor: StaffActor): Promise<void> {
    await this.deps.uow.run(async () => {
      const notification = await this.deps.notifications.findByIdForUpdate(input.id);
      if (!notification) throw new NotFoundError(NOTIFICATION_NOT_FOUND);
      notification.backToDraft();
      await this.deps.notifications.save(notification);
      await this.deps.audit.log({
        actor,
        action: "notification.to_draft",
        entityType: "notification",
        entityId: notification.id,
        changes: { status: { from: "cancelled", to: "draft" } },
      });
    });
  }
}

/** Exclui rascunho ou cancelada (nunca enviada). */
export class DeleteNotificationUseCase {
  constructor(private readonly deps: NotificationUseCaseDeps) {}

  async execute(input: { id: string }, actor: StaffActor): Promise<void> {
    await this.deps.uow.run(async () => {
      const notification = await this.deps.notifications.findByIdForUpdate(input.id);
      if (!notification) throw new NotFoundError(NOTIFICATION_NOT_FOUND);
      notification.assertDeletable();
      await this.deps.notifications.delete(notification.id);
      await this.deps.audit.log({
        actor,
        action: "notification.delete",
        entityType: "notification",
        entityId: notification.id,
        changes: snapshot(notification.toState()),
      });
    });
  }
}

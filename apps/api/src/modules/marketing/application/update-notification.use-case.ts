import type { StaffActor } from "../../../shared/application/actor";
import { diff, hasChanges } from "../../../shared/application/audit-changes";
import { NotFoundError } from "../../../shared/domain/errors";
import type { NotificationChanges } from "../domain/push-notification";
import {
  assertDeepLink,
  assertNotificationEvent,
  assertNotificationStore,
  NOTIFICATION_NOT_FOUND,
  type NotificationUseCaseDeps,
} from "./marketing-deps";

/** Edita o rascunho (agendada/enviada não muda). */
export class UpdateNotificationUseCase {
  constructor(private readonly deps: NotificationUseCaseDeps) {}

  async execute(input: { id: string; changes: NotificationChanges }, actor: StaffActor) {
    await this.deps.uow.run(async () => {
      const notification = await this.deps.notifications.findByIdForUpdate(input.id);
      if (!notification) throw new NotFoundError(NOTIFICATION_NOT_FOUND);
      const before = notification.toState();
      notification.update(input.changes);
      const changes = diff(before, notification.toState());
      if (!hasChanges(changes)) return;
      if (changes.storeId) {
        await assertNotificationStore(this.deps.references, notification.content.storeId);
      }
      if (changes.eventId) {
        await assertNotificationEvent(this.deps.references, notification.content.eventId);
      }
      if (changes.deepLink) {
        await assertDeepLink(this.deps.references, notification.content.deepLink);
      }
      await this.deps.notifications.save(notification);
      await this.deps.audit.log({
        actor,
        action: "notification.update",
        entityType: "notification",
        entityId: notification.id,
        changes,
      });
    });
  }
}

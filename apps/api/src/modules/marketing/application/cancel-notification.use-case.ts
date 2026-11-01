import type { StaffActor } from "../../../shared/application/actor";
import { NotFoundError } from "../../../shared/domain/errors";
import { NOTIFICATION_NOT_FOUND, type NotificationUseCaseDeps } from "./marketing-deps";

export class CancelNotificationUseCase {
  constructor(private readonly deps: NotificationUseCaseDeps) {}

  async execute(input: { id: string }, actor: StaffActor): Promise<void> {
    await this.deps.uow.run(async () => {
      const notification = await this.deps.notifications.findByIdForUpdate(input.id);
      if (!notification) throw new NotFoundError(NOTIFICATION_NOT_FOUND);
      notification.cancel();
      await this.deps.notifications.save(notification);
      await this.deps.audit.log({
        actor,
        action: "notification.cancel",
        entityType: "notification",
        entityId: notification.id,
        changes: { status: { from: "scheduled", to: "cancelled" } },
      });
    });
  }
}

import type { StaffActor } from "../../../shared/application/actor";
import type { PushMessage } from "../../../shared/application/ports/push-sender";
import { NotFoundError } from "../../../shared/domain/errors";
import { assertSomeoneReceives } from "../domain/push-notification";
import {
  buildMessages,
  deliver,
  NOTIFICATION_NOT_FOUND,
  type NotificationUseCaseDeps,
} from "./marketing-deps";

/**
 * Com `scheduledAt` (futuro): agenda, guardando a estimativa de público.
 * Sem: envia agora — marca como enviada na transação e entrega depois do commit.
 */
export class ScheduleNotificationUseCase {
  constructor(private readonly deps: NotificationUseCaseDeps) {}

  async execute(input: { id: string; scheduledAt: Date | null }, actor: StaffActor): Promise<void> {
    const { notifications, audience, clock, audit, uow, push } = this.deps;
    const outbox: PushMessage[] = [];

    await uow.run(async () => {
      const notification = await notifications.findByIdForUpdate(input.id);
      if (!notification) throw new NotFoundError(NOTIFICATION_NOT_FOUND);
      const now = clock.now();

      if (input.scheduledAt) {
        notification.schedule(input.scheduledAt, now, await audience.count(notification.content));
      } else {
        const { recipients, messages } = await buildMessages(audience, notification);
        assertSomeoneReceives(recipients);
        notification.markSent(now, recipients);
        outbox.push(...messages);
      }
      await notifications.save(notification);
      const state = notification.toState();
      await audit.log({
        actor,
        action: input.scheduledAt ? "notification.schedule" : "notification.send",
        entityType: "notification",
        entityId: notification.id,
        changes: {
          status: state.status,
          scheduledAt: state.scheduledAt?.toISOString() ?? null,
          recipientsCount: state.recipientsCount,
        },
      });
    });

    await deliver(push, outbox);
  }
}

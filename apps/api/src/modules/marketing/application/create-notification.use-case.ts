import type { StaffActor } from "../../../shared/application/actor";
import { snapshot } from "../../../shared/application/audit-changes";
import { assertAudienceStore, type NotificationContent } from "../domain/push-notification";
import {
  assertDeepLink,
  assertNotificationEvent,
  assertNotificationStore,
  type NotificationUseCaseDeps,
} from "./marketing-deps";

/** Cria o rascunho (enviar/agendar é outra ação). */
export class CreateNotificationUseCase {
  constructor(private readonly deps: NotificationUseCaseDeps) {}

  async execute(input: NotificationContent, actor: StaffActor): Promise<string> {
    assertAudienceStore(input);
    return this.deps.uow.run(async () => {
      await assertNotificationStore(this.deps.references, input.storeId);
      await assertNotificationEvent(this.deps.references, input.eventId);
      await assertDeepLink(this.deps.references, input.deepLink);
      const notification = await this.deps.notifications.create({ ...input, createdBy: actor.id });
      await this.deps.audit.log({
        actor,
        action: "notification.create",
        entityType: "notification",
        entityId: notification.id,
        changes: snapshot(notification.toState()),
      });
      return notification.id;
    });
  }
}

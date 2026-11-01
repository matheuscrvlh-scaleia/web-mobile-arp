import { systemActor } from "../../../shared/application/actor";
import type { PushMessage } from "../../../shared/application/ports/push-sender";
import { buildMessages, deliver, type NotificationUseCaseDeps } from "./marketing-deps";

const BATCH = 20;
const ACTOR = systemActor("Envio agendado");

/**
 * Job: envia as agendadas que venceram. Cada lote é travado com SKIP LOCKED
 * e marcado como enviado antes da entrega (no máximo uma vez).
 */
export class SendDueNotificationsUseCase {
  constructor(private readonly deps: NotificationUseCaseDeps) {}

  /** Devolve quantas notificações foram enviadas. */
  async execute(): Promise<number> {
    let total = 0;
    for (;;) {
      const outbox: PushMessage[] = [];
      const sent = await this.deps.uow.run(async () => {
        const due = await this.deps.notifications.lockDue(this.deps.clock.now(), BATCH);
        for (const notification of due) {
          const { recipients, messages } = await buildMessages(this.deps.audience, notification);
          notification.markSent(this.deps.clock.now(), recipients);
          await this.deps.notifications.save(notification);
          await this.deps.audit.log({
            actor: ACTOR,
            action: "notification.send",
            entityType: "notification",
            entityId: notification.id,
            changes: { status: "sent", recipientsCount: recipients },
          });
          outbox.push(...messages);
        }
        return due.length;
      });
      await deliver(this.deps.push, outbox);
      total += sent;
      if (sent < BATCH) return total;
    }
  }
}

import { BusinessRuleError, ConflictError, ValidationError } from "../../../shared/domain/errors";
import { applyPatch } from "../../../shared/domain/patch";

export type NotificationAudience = "all" | "opted_in" | "store_followers" | "event_interested";
export type NotificationStatus = "draft" | "scheduled" | "sent" | "cancelled";

export interface PushNotificationProps {
  id: string;
  title: string;
  body: string;
  audience: NotificationAudience;
  storeId: string | null;
  eventId: string | null;
  deepLink: string | null;
  scheduledAt: Date | null;
  sentAt: Date | null;
  status: NotificationStatus;
  recipientsCount: number | null;
  createdBy: string;
}

export interface NotificationContent {
  title: string;
  body: string;
  audience: NotificationAudience;
  storeId: string | null;
  eventId: string | null;
  deepLink: string | null;
}

export type NotificationChanges = Partial<NotificationContent>;

/** Público "seguidores da loja" precisa da loja; "interessados no evento", do evento. */
export function assertAudienceStore(content: NotificationContent): void {
  if (content.audience === "store_followers" && !content.storeId) {
    throw ValidationError.field("storeId", "Escolha a loja");
  }
  if (content.audience === "event_interested" && !content.eventId) {
    throw ValidationError.field("eventId", "Escolha o evento");
  }
}

/**
 * Notificação push. Ciclo: rascunho → agendada → enviada, ou cancelada
 * enquanto agendada. Só o rascunho é editável.
 */
export class PushNotification {
  private constructor(private props: PushNotificationProps) {}

  static restore(props: PushNotificationProps): PushNotification {
    return new PushNotification({ ...props });
  }

  get id(): string {
    return this.props.id;
  }
  get status(): NotificationStatus {
    return this.props.status;
  }
  get content(): NotificationContent {
    const { title, body, audience, storeId, eventId, deepLink } = this.props;
    return { title, body, audience, storeId, eventId, deepLink };
  }

  update(changes: NotificationChanges): void {
    if (this.props.status !== "draft") {
      throw new BusinessRuleError("Só rascunhos podem ser editados");
    }
    const next = applyPatch(this.props, changes);
    assertAudienceStore(next);
    this.props = next;
  }

  /** Agenda (ou reagenda) para um horário futuro, com a estimativa de público. */
  schedule(at: Date, now: Date, estimatedRecipients: number): void {
    this.assertSendable();
    assertSomeoneReceives(estimatedRecipients);
    if (at <= now) throw ValidationError.field("scheduledAt", "Escolha um horário no futuro");
    this.props = {
      ...this.props,
      status: "scheduled",
      scheduledAt: at,
      recipientsCount: estimatedRecipients,
    };
  }

  /** Enviada agora (pelo painel ou pelo job), com o número real de destinatários. */
  markSent(at: Date, recipients: number): void {
    this.assertSendable();
    this.props = { ...this.props, status: "sent", sentAt: at, recipientsCount: recipients };
  }

  cancel(): void {
    if (this.props.status !== "scheduled") {
      throw new BusinessRuleError("Só notificações agendadas podem ser canceladas");
    }
    this.props = { ...this.props, status: "cancelled" };
  }

  /** Cancelada volta a ser rascunho (para editar e agendar de novo). */
  backToDraft(): void {
    if (this.props.status !== "cancelled") {
      throw new BusinessRuleError("Só notificações canceladas voltam para rascunho");
    }
    this.props = { ...this.props, status: "draft", scheduledAt: null, recipientsCount: null };
  }

  /** Só rascunho se exclui; enviada fica no histórico, agendada se cancela antes. */
  assertDeletable(): void {
    if (this.props.status === "draft" || this.props.status === "cancelled") return;
    throw new ConflictError(
      this.props.status === "sent"
        ? "Notificação enviada fica no histórico: não dá para excluir."
        : "Cancele o agendamento antes de excluir.",
    );
  }

  toState(): PushNotificationProps {
    return { ...this.props };
  }

  private assertSendable(): void {
    if (this.props.status !== "draft" && this.props.status !== "scheduled") {
      throw new BusinessRuleError(
        this.props.status === "sent"
          ? "Esta notificação já foi enviada"
          : "Esta notificação foi cancelada",
      );
    }
  }
}

/** Enviar/agendar para ninguém é engano (público errado): o painel avisa antes. */
export function assertSomeoneReceives(recipients: number): void {
  if (recipients <= 0) {
    throw new BusinessRuleError(
      "Ninguém vai receber esta notificação com esse público. Escolha outro público.",
    );
  }
}

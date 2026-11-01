import type { ImageCleanup } from "../../../shared/application/image-variants";
import type { AuditLogger } from "../../../shared/application/ports/audit-logger";
import type { Clock } from "../../../shared/application/ports/clock";
import type { PushMessage, PushSender } from "../../../shared/application/ports/push-sender";
import type { UnitOfWork } from "../../../shared/application/ports/unit-of-work";
import { type FieldErrors, ValidationError } from "../../../shared/domain/errors";
import { type HighlightProps, isEntityTarget, type NewHighlight } from "../domain/highlight";
import type { PushNotification } from "../domain/push-notification";
import type {
  AudienceDirectory,
  HighlightRepository,
  MarketingReferences,
  PushNotificationRepository,
} from "../domain/repositories";

export interface HighlightUseCaseDeps {
  highlights: HighlightRepository;
  references: MarketingReferences;
  audit: AuditLogger;
  uow: UnitOfWork;
  /** Apaga a imagem trocada/do destaque apagado depois do commit. */
  images: ImageCleanup;
}

export interface NotificationUseCaseDeps {
  notifications: PushNotificationRepository;
  audience: AudienceDirectory;
  references: MarketingReferences;
  push: PushSender;
  clock: Clock;
  audit: AuditLogger;
  uow: UnitOfWork;
}

export const HIGHLIGHT_NOT_FOUND = "Destaque não encontrado";
export const NOTIFICATION_NOT_FOUND = "Notificação não encontrada";

const TARGET_LABEL = { event: "Evento", coupon: "Cupom", store: "Loja" } as const;

/**
 * Confere destino e loja patrocinadora. `before` = estado anterior (PATCH):
 * só checa o que mudou.
 */
export async function assertHighlightReferences(
  references: MarketingReferences,
  next: NewHighlight | HighlightProps,
  before?: HighlightProps,
): Promise<void> {
  const issues: FieldErrors = {};
  const targetChanged =
    !before || before.targetType !== next.targetType || before.targetId !== next.targetId;
  if (targetChanged && isEntityTarget(next.targetType) && next.targetId) {
    if (!(await references.targetExists(next.targetType, next.targetId))) {
      issues.targetId = [`${TARGET_LABEL[next.targetType]} não encontrado(a)`];
    }
  }
  if (
    next.sponsorStoreId &&
    next.sponsorStoreId !== before?.sponsorStoreId &&
    !(await references.storeExists(next.sponsorStoreId))
  ) {
    issues.sponsorStoreId = ["Loja não encontrada"];
  }
  if (Object.keys(issues).length > 0) throw new ValidationError("Referência inválida", issues);
}

export async function assertNotificationStore(
  references: MarketingReferences,
  storeId: string | null,
): Promise<void> {
  if (storeId && !(await references.storeExists(storeId))) {
    throw ValidationError.field("storeId", "Loja não encontrada");
  }
}

/** Mensagens de push de uma notificação para os aparelhos do público (uma por token). */
export async function buildMessages(
  audience: AudienceDirectory,
  notification: PushNotification,
): Promise<{ recipients: number; messages: PushMessage[] }> {
  const { title, body, audience: target, storeId, deepLink } = notification.content;
  const list = await audience.recipients(target, storeId);
  const data: Record<string, string> = { notificationId: notification.id };
  if (deepLink) data.url = deepLink;
  return {
    recipients: new Set(list.map((r) => r.visitorId)).size,
    messages: list.map((r) => ({ to: r.token, title, body, data })),
  };
}

const PUSH_CHUNK = 100;

/**
 * Entrega em lotes (limite do Expo Push). Chamado DEPOIS do commit: se o envio
 * falhar no meio, a notificação não é reenviada (no máximo uma vez é melhor
 * que push duplicado).
 */
export async function deliver(push: PushSender, messages: PushMessage[]): Promise<void> {
  for (let i = 0; i < messages.length; i += PUSH_CHUNK) {
    await push.send(messages.slice(i, i + PUSH_CHUNK));
  }
}

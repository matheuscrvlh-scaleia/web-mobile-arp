import type { EntityTarget, Highlight, NewHighlight } from "./highlight";
import type {
  NotificationAudience,
  NotificationContent,
  PushNotification,
} from "./push-notification";

export interface HighlightRepository {
  findById(id: string): Promise<Highlight | null>;
  /** Entra no fim do carrossel. */
  create(data: NewHighlight): Promise<Highlight>;
  save(highlight: Highlight): Promise<void>;
  delete(id: string): Promise<void>;
  /** Ids de todos os destaques, com trava (reordenação concorrente). */
  lockAllIds(): Promise<string[]>;
  /** Grava sort_order = posição (1..n) na ordem dada. */
  applyOrder(ids: readonly string[]): Promise<void>;
}

export interface MarketingReferences {
  targetExists(type: EntityTarget, id: string): Promise<boolean>;
  storeExists(id: string): Promise<boolean>;
}

export interface NewPushNotification extends NotificationContent {
  createdBy: string;
}

export interface PushNotificationRepository {
  /** Com trava de linha: agendar/enviar/cancelar não correm juntos. */
  findByIdForUpdate(id: string): Promise<PushNotification | null>;
  create(data: NewPushNotification): Promise<PushNotification>;
  save(notification: PushNotification): Promise<void>;
  /** Agendadas vencidas, travadas (skip locked: réplicas não pegam a mesma). */
  lockDue(now: Date, limit: number): Promise<PushNotification[]>;
}

export interface PushRecipient {
  visitorId: string;
  token: string;
}

/** Público das notificações: visitantes ativos com ao menos um aparelho registrado. */
export interface AudienceDirectory {
  count(audience: NotificationAudience, storeId: string | null): Promise<number>;
  recipients(audience: NotificationAudience, storeId: string | null): Promise<PushRecipient[]>;
}

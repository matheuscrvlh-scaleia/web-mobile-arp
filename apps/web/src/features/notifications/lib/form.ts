import {
  type CreateNotificationBody,
  createNotificationBodySchema,
  type PushNotification,
  type UpdateNotificationBody,
} from "@arp/contracts";
import type { z } from "zod";
import { pickDirty } from "@/shared/lib/forms";

/** O formulário usa o schema de criação do contrato (público + loja). */
export const notificationFormSchema = createNotificationBodySchema;
export type NotificationFormInput = z.input<typeof notificationFormSchema>;
export type NotificationFormValues = z.output<typeof notificationFormSchema>;

export const NOTIFICATION_FORM_FIELDS = [
  "title",
  "body",
  "audience",
  "storeId",
  "eventId",
  "deepLink",
];

/**
 * Valores do formulário. Também serve para "Duplicar" / "Usar como base": o
 * título fica igual (é o que o visitante lê; "(cópia)" iria no push).
 */
export function notificationToFormValues(n?: PushNotification): NotificationFormInput {
  return {
    title: n?.title ?? "",
    body: n?.body ?? "",
    audience: n?.audience ?? "opted_in",
    storeId: n?.store?.id ?? null,
    eventId: n?.event?.id ?? null,
    deepLink: n?.deepLink ?? null,
  };
}

/** Loja só vale para "seguidores de uma loja" e evento para "interessados"; nos outros, null. */
export function cleanNotification(v: NotificationFormValues): CreateNotificationBody {
  return {
    ...v,
    storeId: v.audience === "store_followers" ? (v.storeId ?? null) : null,
    eventId: v.audience === "event_interested" ? (v.eventId ?? null) : null,
    deepLink: v.deepLink ?? null,
  };
}

/** PATCH só do que mudou; público, loja e evento andam juntos (a regra liga os três). */
export function notificationPatch(
  values: NotificationFormValues,
  dirty: Partial<Record<keyof NotificationFormValues, unknown>>,
): UpdateNotificationBody {
  const clean = cleanNotification(values);
  const patch: UpdateNotificationBody = pickDirty(clean, dirty);
  if (dirty.audience || dirty.storeId || dirty.eventId) {
    patch.audience = clean.audience;
    patch.storeId = clean.storeId;
    patch.eventId = clean.eventId;
  }
  return patch;
}

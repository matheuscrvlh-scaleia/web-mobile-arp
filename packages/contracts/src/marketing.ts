import { z } from "zod";
import {
  demoFlagSchema,
  idSchema,
  isoDateTimeSchema,
  listOf,
  mediaUrlSchema,
  paginated,
  paginationQuerySchema,
  patchOf,
  phaseSchema,
  refSchema,
  urlSchema,
} from "./common";

/* Destaques (carrossel da home do app; área de mídia paga) --------------- */

export const highlightBadgeSchema = z.enum(["featured", "sponsored"]);
export type HighlightBadge = z.infer<typeof highlightBadgeSchema>;
export const highlightTargetSchema = z.enum(["event", "coupon", "store", "url", "none"]);
export type HighlightTarget = z.infer<typeof highlightTargetSchema>;
export const highlightStatusSchema = z.enum(["draft", "published", "archived"]);
export type HighlightStatus = z.infer<typeof highlightStatusSchema>;

export const highlightSchema = z.object({
  id: idSchema,
  title: z.string(),
  subtitle: z.string().nullable(),
  ctaLabel: z.string().nullable(),
  imageUrl: z.string().nullable(),
  /** "Destaque" (da ARP) ou "Patrocinado" (vendido pelo comercial). */
  badge: highlightBadgeSchema,
  targetType: highlightTargetSchema,
  /** Id do evento, cupom ou loja (conforme targetType). */
  targetId: idSchema.nullable(),
  /** Nome do alvo, para exibir sem outra consulta. */
  targetLabel: z.string().nullable(),
  targetUrl: z.string().nullable(),
  sponsorStore: refSchema.nullable(),
  startsAt: isoDateTimeSchema,
  endsAt: isoDateTimeSchema,
  sortOrder: z.number().int(),
  status: highlightStatusSchema,
  phase: phaseSchema,
  impressions: z.number().int(),
  clicks: z.number().int(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});
export type Highlight = z.infer<typeof highlightSchema>;
export const highlightListSchema = listOf(highlightSchema);

const highlightFields = {
  title: z.string().trim().min(3).max(80),
  subtitle: z.string().trim().max(160).nullable().optional(),
  ctaLabel: z.string().trim().max(30).nullable().optional(),
  imageUrl: mediaUrlSchema.nullable().optional(),
  badge: highlightBadgeSchema.default("featured"),
  targetType: highlightTargetSchema.default("none"),
  targetId: idSchema.nullable().optional(),
  targetUrl: urlSchema.nullable().optional(),
  sponsorStoreId: idSchema.nullable().optional(),
  startsAt: isoDateTimeSchema,
  endsAt: isoDateTimeSchema,
  status: highlightStatusSchema.default("draft"),
};

type HighlightShape = {
  targetType?: HighlightTarget;
  targetId?: string | null;
  targetUrl?: string | null;
  startsAt?: string;
  endsAt?: string;
};

export function highlightIssues(v: HighlightShape): { path: string; message: string }[] {
  const issues: { path: string; message: string }[] = [];
  const needsId = v.targetType === "event" || v.targetType === "coupon" || v.targetType === "store";
  if (needsId && !v.targetId) issues.push({ path: "targetId", message: "Escolha o destino" });
  if (v.targetType === "url" && !v.targetUrl) {
    issues.push({ path: "targetUrl", message: "Informe o link" });
  }
  if (v.startsAt && v.endsAt && new Date(v.endsAt) <= new Date(v.startsAt)) {
    issues.push({ path: "endsAt", message: "O fim precisa ser depois do início" });
  }
  return issues;
}

export const createHighlightBodySchema = z.object(highlightFields).superRefine((v, ctx) => {
  for (const i of highlightIssues(v)) ctx.addIssue({ code: "custom", ...i, path: [i.path] });
});
export type CreateHighlightBody = z.infer<typeof createHighlightBodySchema>;
export type CreateHighlightInput = z.input<typeof createHighlightBodySchema>;
export const updateHighlightBodySchema = z.object(patchOf(highlightFields));
export type UpdateHighlightBody = z.infer<typeof updateHighlightBodySchema>;

/** Nova ordem do carrossel: todos os ids, na ordem desejada. */
export const reorderHighlightsBodySchema = z.object({ ids: z.array(idSchema).min(1).max(200) });
export type ReorderHighlightsBody = z.infer<typeof reorderHighlightsBodySchema>;

export const listHighlightsQuerySchema = z.object({
  status: highlightStatusSchema.optional(),
  phase: phaseSchema.optional(),
});
export type ListHighlightsQuery = z.infer<typeof listHighlightsQuerySchema>;

/* Notificações push ------------------------------------------------------ */

export const notificationAudienceSchema = z.enum(["all", "opted_in", "store_followers"]);
export type NotificationAudience = z.infer<typeof notificationAudienceSchema>;
export const notificationStatusSchema = z.enum(["draft", "scheduled", "sent", "cancelled"]);
export type NotificationStatus = z.infer<typeof notificationStatusSchema>;

export const pushNotificationSchema = z.object({
  id: idSchema,
  title: z.string(),
  body: z.string(),
  audience: notificationAudienceSchema,
  /** Obrigatória quando audience = store_followers. */
  store: refSchema.nullable(),
  /** Tela do app que abre ao tocar (ex.: arp://cupom/<id>). */
  deepLink: z.string().nullable(),
  scheduledAt: isoDateTimeSchema.nullable(),
  sentAt: isoDateTimeSchema.nullable(),
  status: notificationStatusSchema,
  /** Estimativa ao agendar; número real depois do envio. */
  recipientsCount: z.number().int().nullable(),
  createdBy: refSchema,
  isDemo: demoFlagSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});
export type PushNotification = z.infer<typeof pushNotificationSchema>;
export const pushNotificationPageSchema = paginated(pushNotificationSchema);

const notificationFields = {
  title: z.string().trim().min(3).max(65),
  body: z.string().trim().min(3).max(240),
  audience: notificationAudienceSchema,
  storeId: idSchema.nullable().optional(),
  deepLink: z.string().trim().max(300).nullable().optional(),
};

export const createNotificationBodySchema = z
  .object(notificationFields)
  .refine((v) => v.audience !== "store_followers" || !!v.storeId, {
    message: "Escolha a loja",
    path: ["storeId"],
  });
export type CreateNotificationBody = z.infer<typeof createNotificationBodySchema>;
export const updateNotificationBodySchema = z.object(notificationFields).partial();
export type UpdateNotificationBody = z.infer<typeof updateNotificationBodySchema>;

/** Agenda (scheduledAt) ou envia agora (sem scheduledAt). */
export const scheduleNotificationBodySchema = z.object({
  scheduledAt: isoDateTimeSchema.nullable().optional(),
});
export type ScheduleNotificationBody = z.infer<typeof scheduleNotificationBodySchema>;

export const audienceEstimateQuerySchema = z.object({
  audience: notificationAudienceSchema,
  storeId: idSchema.optional(),
});
export const audienceEstimateSchema = z.object({ recipientsCount: z.number().int() });

export const listNotificationsQuerySchema = paginationQuerySchema.extend({
  status: notificationStatusSchema.optional(),
});
export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;

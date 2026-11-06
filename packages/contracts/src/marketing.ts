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
/** paused = "No ar" desligado (sai do carrossel, mantém a posição); archived sai da ordem. */
export const highlightStatusSchema = z.enum(["draft", "published", "paused", "archived"]);
export type HighlightStatus = z.infer<typeof highlightStatusSchema>;
/**
 * Por que o destino não abre direito no app (evento cancelado, cupom pausado,
 * loja desativada…); null = destino ok ou sem destino de cadastro.
 */
export const highlightTargetIssueSchema = z.enum([
  "draft",
  "paused",
  "cancelled",
  "ended",
  "archived",
  "inactive",
  "missing",
]);
export type HighlightTargetIssue = z.infer<typeof highlightTargetIssueSchema>;

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
  targetIssue: highlightTargetIssueSchema.nullable(),
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
  title: z
    .string()
    .trim()
    .min(3, "Dê um título ao destaque (pelo menos 3 letras)")
    .max(80, "Use até 80 letras"),
  subtitle: z.string().trim().max(160, "Use até 160 letras").nullable().optional(),
  ctaLabel: z.string().trim().max(30, "Use até 30 letras").nullable().optional(),
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

/** event_interested = quem marcou interesse no evento (aviso de serviço: adiado, cancelado). */
export const notificationAudienceSchema = z.enum([
  "all",
  "opted_in",
  "store_followers",
  "event_interested",
]);
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
  /** Obrigatório quando audience = event_interested. */
  event: refSchema.nullable(),
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

/* Destino do toque (deep link) -------------------------------------------- */

/** Telas do app sem parâmetro que o push pode abrir (o app ignora outras e abre o Início). */
export const APP_LINK_SCREENS = ["agenda", "cupons", "desafios", "mapa", "lojas", "carteira"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** id ou slug da loja: nada que mude o caminho (igual ao app). */
const STORE_PARAM_RE = /^[A-Za-z0-9._~%-]{1,200}$/;

/** Para onde o toque leva, já decifrado. */
export type DeepLinkTarget =
  | { kind: "home" }
  | { kind: "event" | "coupon"; id: string }
  | { kind: "store"; id: string }
  | { kind: "screen"; screen: string }
  | { kind: "url"; url: string };

/** Lê um deep link (arp://evento/<id>, https://…). null = formato que o app não abre. */
export function parseDeepLink(link: string | null | undefined): DeepLinkTarget | null {
  const raw = (link ?? "").trim();
  if (!raw) return { kind: "home" };
  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      return url.hostname.includes(".") ? { kind: "url", url: raw } : null;
    } catch {
      return null;
    }
  }
  const m = /^arp:\/\/([a-z]+)(?:\/([^/?#]+))?\/?$/i.exec(raw);
  if (!m) return null;
  const name = (m[1] ?? "").toLowerCase();
  const param = m[2];
  if (param === undefined)
    return APP_LINK_SCREENS.includes(name) ? { kind: "screen", screen: name } : null;
  if ((name === "evento" || name === "cupom") && UUID_RE.test(param)) {
    return { kind: name === "evento" ? "event" : "coupon", id: param };
  }
  if (name === "loja" && STORE_PARAM_RE.test(param)) return { kind: "store", id: param };
  return null;
}

/** Monta o deep link do destino escolhido no painel. */
export function buildDeepLink(target: DeepLinkTarget): string | null {
  switch (target.kind) {
    case "home":
      return null;
    case "event":
      return `arp://evento/${target.id}`;
    case "coupon":
      return `arp://cupom/${target.id}`;
    case "store":
      return `arp://loja/${target.id}`;
    case "screen":
      return `arp://${target.screen}`;
    case "url":
      return target.url;
  }
}

export const deepLinkSchema = z
  .string()
  .trim()
  .max(300, "Link longo demais")
  .refine((v) => parseDeepLink(v) !== null, "Escolha o destino de novo: este link o app não abre");

const notificationFields = {
  title: z
    .string()
    .trim()
    .min(3, "Escreva o título (pelo menos 3 letras)")
    .max(65, "O título passa de 65 letras: encurte para não cortar no celular"),
  body: z
    .string()
    .trim()
    .min(3, "Escreva a mensagem (pelo menos 3 letras)")
    .max(240, "A mensagem passa de 240 letras: encurte"),
  audience: notificationAudienceSchema,
  storeId: idSchema.nullable().optional(),
  eventId: idSchema.nullable().optional(),
  deepLink: deepLinkSchema.nullable().optional(),
};

export const createNotificationBodySchema = z
  .object(notificationFields)
  .refine((v) => v.audience !== "store_followers" || !!v.storeId, {
    message: "Escolha a loja",
    path: ["storeId"],
  })
  .refine((v) => v.audience !== "event_interested" || !!v.eventId, {
    message: "Escolha o evento",
    path: ["eventId"],
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
  eventId: idSchema.optional(),
});
export const audienceEstimateSchema = z.object({ recipientsCount: z.number().int() });

export const listNotificationsQuerySchema = paginationQuerySchema.extend({
  status: notificationStatusSchema.optional(),
});
export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;

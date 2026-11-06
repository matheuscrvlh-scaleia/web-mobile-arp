import { z } from "zod";
import {
  demoFlagSchema,
  hexColorSchema,
  iconNameSchema,
  idSchema,
  isoDateTimeSchema,
  paginated,
  paginationQuerySchema,
} from "./common";
import { prizeRedemptionStatusSchema, sealRefSchema } from "./gamification";
import { couponClaimSchema } from "./promotions";

/* Visitantes: contas do app (não acessam o painel). --------------------- */

export const visitorStatusSchema = z.enum(["active", "blocked"]);
export type VisitorStatus = z.infer<typeof visitorStatusSchema>;
export const authProviderSchema = z.enum(["password", "google", "apple"]);
export type AuthProvider = z.infer<typeof authProviderSchema>;

export const visitorSummarySchema = z.object({
  id: idSchema,
  name: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  authProvider: authProviderSchema,
  status: visitorStatusSchema,
  marketingOptIn: z.boolean(),
  sealsCount: z.number().int(),
  activeClaimsCount: z.number().int(),
  redeemedClaimsCount: z.number().int(),
  lastSeenAt: isoDateTimeSchema.nullable(),
  /** Dados pessoais apagados a pedido (LGPD): nome, e-mail e telefone não existem mais. */
  anonymizedAt: isoDateTimeSchema.nullable(),
  isDemo: demoFlagSchema,
  createdAt: isoDateTimeSchema,
});
export type VisitorSummary = z.infer<typeof visitorSummarySchema>;
export const visitorPageSchema = paginated(visitorSummarySchema);

const storeMini = z.object({
  id: idSchema,
  name: z.string(),
  icon: iconNameSchema,
  brandColor: hexColorSchema,
});

export const visitorDetailSchema = visitorSummarySchema.extend({
  blockedReason: z.string().nullable(),
  termsAcceptedAt: isoDateTimeSchema.nullable(),
  /** Soma da economia estimada dos cupons usados. */
  savingsCents: z.number().int(),
  favorites: z.array(storeMini),
  follows: z.array(storeMini),
  seals: z.array(
    z.object({
      seal: sealRefSchema,
      challengeTitle: z.string(),
      campaignName: z.string(),
      earnedAt: isoDateTimeSchema,
    }),
  ),
  /** Últimos 20 cupons pegos. */
  recentClaims: z.array(couponClaimSchema),
  interests: z.array(
    z.object({
      event: z.object({ id: idSchema, title: z.string() }),
      createdAt: isoDateTimeSchema,
    }),
  ),
  /** Clube ARP: saldo de pontos e últimas trocas. */
  club: z.object({
    points: z.number().int(),
    /** Pontos que vencem nos próximos 30 dias e quando vence o primeiro. */
    expiringPoints: z.number().int(),
    nextExpiryAt: isoDateTimeSchema.nullable(),
    /** Últimas 10 trocas. */
    redemptions: z.array(
      z.object({
        id: idSchema,
        prize: z.object({ id: idSchema, name: z.string() }),
        points: z.number().int(),
        status: prizeRedemptionStatusSchema,
        createdAt: isoDateTimeSchema,
        deliveredAt: isoDateTimeSchema.nullable(),
      }),
    ),
  }),
});
export type VisitorDetail = z.infer<typeof visitorDetailSchema>;

export const listVisitorsQuerySchema = paginationQuerySchema.extend({
  status: visitorStatusSchema.optional(),
  marketingOptIn: z.enum(["true", "false"]).optional(),
});
export type ListVisitorsQuery = z.infer<typeof listVisitorsQuerySchema>;

export const updateVisitorStatusBodySchema = z
  .object({
    status: visitorStatusSchema,
    reason: z.string().trim().max(240).nullable().optional(),
  })
  .refine((v) => v.status !== "blocked" || !!v.reason, {
    message: "Informe o motivo do bloqueio",
    path: ["reason"],
  });
export type UpdateVisitorStatusBody = z.infer<typeof updateVisitorStatusBodySchema>;

/** LGPD: apaga nome, e-mail, telefone, foto e apelido. Irreversível; os números agregados ficam. */
export const anonymizeVisitorBodySchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Escreva o motivo (ex.: pedido do titular por e-mail)")
    .max(240, "Use até 240 caracteres"),
});
export type AnonymizeVisitorBody = z.infer<typeof anonymizeVisitorBodySchema>;

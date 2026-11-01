import { z } from "zod";
import {
  hexColorSchema,
  iconNameSchema,
  idSchema,
  isoDateTimeSchema,
  paginated,
  paginationQuerySchema,
} from "./common";
import { sealRefSchema } from "./gamification";
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

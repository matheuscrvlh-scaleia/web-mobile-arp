import { z } from "zod";
import {
  hexColorSchema,
  iconNameSchema,
  idSchema,
  isoDateTimeSchema,
  listOf,
  paginated,
  paginationQuerySchema,
  patchOf,
  phaseSchema,
  refSchema,
  slugSchema,
} from "./common";

/*
 * Gamificação mensal (vinda do app):
 * - Uma campanha (ex.: "Desafios de outubro") tem início e fim.
 * - Cada desafio da campanha dá um selo. Validação por QR Code (mostrado
 *   pela loja ou pela ARP) ou automática (ex.: pagar o estacionamento).
 * - O QR só vale enquanto a campanha está no ar e dá o selo uma vez por pessoa.
 * - Faixas de benefício: ao juntar N selos na campanha, ganha algo.
 */

/* Selos ------------------------------------------------------------------ */

export const sealStatusSchema = z.enum(["active", "archived"]);

export const sealSchema = z.object({
  id: idSchema,
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  icon: iconNameSchema,
  gradientFrom: hexColorSchema,
  gradientTo: hexColorSchema,
  sortOrder: z.number().int(),
  status: sealStatusSchema,
  earnedCount: z.number().int(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});
export type Seal = z.infer<typeof sealSchema>;
export const sealListSchema = listOf(sealSchema);

export const createSealBodySchema = z.object({
  name: z.string().trim().min(2).max(40),
  slug: slugSchema.optional(),
  description: z.string().trim().max(240).nullable().optional(),
  icon: iconNameSchema,
  gradientFrom: hexColorSchema,
  gradientTo: hexColorSchema,
  sortOrder: z.number().int().min(0).max(999).default(0),
  status: sealStatusSchema.default("active"),
});
export type CreateSealBody = z.infer<typeof createSealBodySchema>;
export const updateSealBodySchema = z.object(patchOf(createSealBodySchema.shape));
export type UpdateSealBody = z.infer<typeof updateSealBodySchema>;

export const sealRefSchema = z.object({
  id: idSchema,
  name: z.string(),
  icon: iconNameSchema,
  gradientFrom: hexColorSchema,
  gradientTo: hexColorSchema,
});
export type SealRef = z.infer<typeof sealRefSchema>;

/* Campanhas e faixas ----------------------------------------------------- */

export const campaignStatusSchema = z.enum(["draft", "published", "archived"]);
export type CampaignStatus = z.infer<typeof campaignStatusSchema>;

export const rewardTierSchema = z.object({
  id: idSchema,
  /** Quantidade de selos na campanha para liberar o benefício. */
  threshold: z.number().int(),
  label: z.string(),
  icon: iconNameSchema,
  /** Visitantes que já alcançaram a faixa. */
  reachedCount: z.number().int(),
});
export type RewardTier = z.infer<typeof rewardTierSchema>;

export const campaignSchema = z.object({
  id: idSchema,
  name: z.string(),
  description: z.string().nullable(),
  startsAt: isoDateTimeSchema,
  endsAt: isoDateTimeSchema,
  status: campaignStatusSchema,
  /** Em relação a agora (só significa algo quando publicada). */
  phase: phaseSchema,
  tiers: z.array(rewardTierSchema),
  challengesCount: z.number().int(),
  /** Visitantes com ao menos um selo na campanha. */
  participantsCount: z.number().int(),
  sealsAwarded: z.number().int(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});
export type Campaign = z.infer<typeof campaignSchema>;
export const campaignListSchema = listOf(campaignSchema);

const campaignFields = {
  name: z.string().trim().min(3).max(80),
  description: z.string().trim().max(400).nullable().optional(),
  startsAt: isoDateTimeSchema,
  endsAt: isoDateTimeSchema,
  status: campaignStatusSchema.default("draft"),
};
const campaignDates = (v: { startsAt?: string; endsAt?: string }) =>
  !v.startsAt || !v.endsAt || new Date(v.endsAt) > new Date(v.startsAt);
const campaignDatesIssue = { message: "O fim precisa ser depois do início", path: ["endsAt"] };

export const createCampaignBodySchema = z
  .object(campaignFields)
  .refine(campaignDates, campaignDatesIssue);
export type CreateCampaignBody = z.infer<typeof createCampaignBodySchema>;
export const updateCampaignBodySchema = z
  .object(patchOf(campaignFields))
  .refine(campaignDates, campaignDatesIssue);
export type UpdateCampaignBody = z.infer<typeof updateCampaignBodySchema>;

/** Substitui todas as faixas da campanha de uma vez. */
export const replaceTiersBodySchema = z.object({
  tiers: z
    .array(
      z.object({
        threshold: z.number().int().min(1).max(100),
        label: z.string().trim().min(2).max(80),
        icon: iconNameSchema,
      }),
    )
    .max(10)
    .refine((l) => new Set(l.map((t) => t.threshold)).size === l.length, "Faixa repetida"),
});
export type ReplaceTiersBody = z.infer<typeof replaceTiersBodySchema>;

/* Desafios --------------------------------------------------------------- */

export const challengeValidationSchema = z.enum(["qr", "auto"]);
export type ChallengeValidation = z.infer<typeof challengeValidationSchema>;
export const challengeStatusSchema = z.enum(["active", "inactive"]);

export const challengeSchema = z.object({
  id: idSchema,
  campaign: refSchema,
  seal: sealRefSchema,
  title: z.string(),
  /** Como cumprir (ex.: "QR Code no fim do tour, na praça central"). */
  howTo: z.string(),
  icon: iconNameSchema,
  validation: challengeValidationSchema,
  store: refSchema.nullable(),
  event: z.object({ id: idSchema, title: z.string() }).nullable(),
  sortOrder: z.number().int(),
  status: challengeStatusSchema,
  completionsCount: z.number().int(),
  qrCodesCount: z.number().int(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});
export type Challenge = z.infer<typeof challengeSchema>;
export const challengeListSchema = listOf(challengeSchema);

export const createChallengeBodySchema = z.object({
  campaignId: idSchema,
  sealId: idSchema,
  title: z.string().trim().min(3).max(120),
  howTo: z.string().trim().min(3).max(240),
  icon: iconNameSchema,
  validation: challengeValidationSchema,
  storeId: idSchema.nullable().optional(),
  eventId: idSchema.nullable().optional(),
  sortOrder: z.number().int().min(0).max(999).default(0),
  status: challengeStatusSchema.default("active"),
});
export type CreateChallengeBody = z.infer<typeof createChallengeBodySchema>;
export const updateChallengeBodySchema = z.object(
  patchOf(createChallengeBodySchema.omit({ campaignId: true }).shape),
);
export type UpdateChallengeBody = z.infer<typeof updateChallengeBodySchema>;

export const listChallengesQuerySchema = z.object({ campaignId: idSchema.optional() });
export type ListChallengesQuery = z.infer<typeof listChallengesQuerySchema>;

/* QR Codes --------------------------------------------------------------- */

export const qrCodeStatusSchema = z.enum(["active", "revoked"]);

export const qrCodeSchema = z.object({
  id: idSchema,
  challengeId: idSchema,
  label: z.string(),
  /** Texto codificado no QR (ex.: arp://selo/<token>). Lido pelo app. */
  payload: z.string(),
  validFrom: isoDateTimeSchema.nullable(),
  validUntil: isoDateTimeSchema.nullable(),
  status: qrCodeStatusSchema,
  scans: z.object({
    awarded: z.number().int(),
    duplicate: z.number().int(),
    expired: z.number().int(),
  }),
  createdAt: isoDateTimeSchema,
});
export type QrCode = z.infer<typeof qrCodeSchema>;
export const qrCodeListSchema = listOf(qrCodeSchema);

export const createQrCodeBodySchema = z.object({
  label: z.string().trim().min(2).max(60),
  validFrom: isoDateTimeSchema.nullable().optional(),
  validUntil: isoDateTimeSchema.nullable().optional(),
});
export type CreateQrCodeBody = z.infer<typeof createQrCodeBodySchema>;

export const updateQrCodeBodySchema = z.object({
  label: z.string().trim().min(2).max(60).optional(),
  status: qrCodeStatusSchema.optional(),
  validFrom: isoDateTimeSchema.nullable().optional(),
  validUntil: isoDateTimeSchema.nullable().optional(),
});
export type UpdateQrCodeBody = z.infer<typeof updateQrCodeBodySchema>;

/* Selos conquistados ----------------------------------------------------- */

export const scanResultSchema = z.enum(["awarded", "duplicate", "expired", "invalid"]);
export type ScanResult = z.infer<typeof scanResultSchema>;

export const earnedSealSchema = z.object({
  id: idSchema,
  seal: sealRefSchema,
  challenge: z.object({ id: idSchema, title: z.string() }),
  campaign: refSchema,
  visitor: refSchema,
  earnedAt: isoDateTimeSchema,
});
export type EarnedSeal = z.infer<typeof earnedSealSchema>;
export const earnedSealPageSchema = paginated(earnedSealSchema);

export const listEarnedSealsQuerySchema = paginationQuerySchema.extend({
  campaignId: idSchema.optional(),
  challengeId: idSchema.optional(),
  visitorId: idSchema.optional(),
});
export type ListEarnedSealsQuery = z.infer<typeof listEarnedSealsQuerySchema>;

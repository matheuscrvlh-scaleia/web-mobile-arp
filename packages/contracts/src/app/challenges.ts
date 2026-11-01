import { z } from "zod";
import { iconNameSchema, idSchema, isoDateTimeSchema, refSchema } from "../common";
import { challengeValidationSchema, sealRefSchema } from "../gamification";
import { storeLinkSchema } from "./coupons";

/* Desafios do mês (campanha no ar) e progresso do visitante. */

export const tierProgressSchema = z.object({
  threshold: z.number().int(),
  label: z.string(),
  icon: iconNameSchema,
  reached: z.boolean(),
});

export const campaignProgressSchema = z.object({
  /** Selos ganhos na campanha. */
  earned: z.number().int(),
  /** Desafios ativos da campanha. */
  total: z.number().int(),
  tiers: z.array(tierProgressSchema),
  /** Próxima faixa a alcançar (null quando todas já foram alcançadas ou não há faixas). */
  nextTier: z
    .object({
      threshold: z.number().int(),
      label: z.string(),
      icon: iconNameSchema,
      /** Selos que faltam. */
      missing: z.number().int(),
    })
    .nullable(),
});
export type CampaignProgress = z.infer<typeof campaignProgressSchema>;

export const challengeItemSchema = z.object({
  id: idSchema,
  title: z.string(),
  howTo: z.string(),
  icon: iconNameSchema,
  validation: challengeValidationSchema,
  seal: sealRefSchema,
  store: storeLinkSchema.nullable(),
  event: z.object({ id: idSchema, title: z.string() }).nullable(),
  /** O visitante logado já ganhou o selo deste desafio. */
  earned: z.boolean(),
  earnedAt: isoDateTimeSchema.nullable(),
});
export type ChallengeItem = z.infer<typeof challengeItemSchema>;

export const liveCampaignSchema = z.object({
  id: idSchema,
  name: z.string(),
  description: z.string().nullable(),
  startsAt: isoDateTimeSchema,
  endsAt: isoDateTimeSchema,
});

export const challengesSchema = z.object({
  /** null = nenhuma campanha no ar agora. */
  campaign: liveCampaignSchema.nullable(),
  challenges: z.array(challengeItemSchema),
  progress: campaignProgressSchema,
});
export type Challenges = z.infer<typeof challengesSchema>;

/** Conteúdo lido do QR Code (ex.: arp://selo/<token>). */
export const scanQrBodySchema = z.object({ payload: z.string().trim().min(1).max(300) });
export type ScanQrBody = z.infer<typeof scanQrBodySchema>;

/**
 * Selo ganho. Recusas vêm como erro: QR_INVALID (422), QR_EXPIRED (410),
 * SEAL_ALREADY_EARNED (409).
 */
export const scanResultSchema = z.object({
  seal: sealRefSchema,
  challenge: z.object({ id: idSchema, title: z.string() }),
  campaign: refSchema,
  earnedAt: isoDateTimeSchema,
  progress: campaignProgressSchema,
});
export type ScanResult = z.infer<typeof scanResultSchema>;

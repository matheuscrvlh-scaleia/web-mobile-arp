import { z } from "zod";
import { idSchema, isoDateTimeSchema } from "../common";
import { prizeKindSchema, rankingEntrySchema, sealRefSchema } from "../gamification";

/*
 * Clube ARP (Fase 2). Cada selo vale pontos e vence depois de alguns meses;
 * vencido, os pontos saem do total. Os pontos são trocados por prêmios na
 * lojinha. O ranking mostra só quem aceitou, só com apelido.
 */

export const clubPointsSchema = z.object({
  /** Pontos para trocar agora (nunca negativo). */
  total: z.number().int(),
  /** Até quando os pontos valem para troca (null = sem pontos). */
  validUntil: isoDateTimeSchema.nullable(),
  /** Próximo prêmio que ainda não dá para trocar. */
  nextPrize: z
    .object({ id: idSchema, name: z.string(), points: z.number().int(), missing: z.number().int() })
    .nullable(),
});
export type ClubPoints = z.infer<typeof clubPointsSchema>;

/** active = ganho e valendo · expired = venceu (pontos fora) · none = ainda não ganho. */
export const clubSealStateSchema = z.enum(["active", "expired", "none"]);
export type ClubSealState = z.infer<typeof clubSealStateSchema>;

export const clubSealSchema = z.object({
  seal: sealRefSchema,
  points: z.number().int(),
  repeatable: z.boolean(),
  state: clubSealStateSchema,
  /** Vezes que ganhou (repetível pode ser mais de 1). */
  times: z.number().int(),
  /** Validade do selo ativo mais recente ("vence dd/mm") ou do último que venceu. */
  expiresAt: isoDateTimeSchema.nullable(),
});
export type ClubSeal = z.infer<typeof clubSealSchema>;

export const clubPrizeSchema = z.object({
  id: idSchema,
  name: z.string(),
  description: z.string(),
  kind: prizeKindSchema,
  points: z.number().int(),
  /** "restam N" (só aparece prêmio com estoque). */
  stock: z.number().int(),
  imageUrl: z.string().nullable(),
});
export type ClubPrize = z.infer<typeof clubPrizeSchema>;

export const clubSchema = z.object({
  /** null sem login. */
  points: clubPointsSchema.nullable(),
  seals: z.array(clubSealSchema),
  prizes: z.array(clubPrizeSchema),
  ranking: z.object({
    top: z.array(rankingEntrySchema),
    /** Posição do visitante (null = não participa ou sem login). */
    me: rankingEntrySchema.nullable(),
    joined: z.boolean(),
  }),
});
export type Club = z.infer<typeof clubSchema>;

/** Troca feita: o visitante mostra o código no Centro de Informações. */
export const prizeRedeemResultSchema = z.object({
  code: z.string(),
  prize: z.object({ id: idSchema, name: z.string() }),
  points: z.number().int(),
  totalPoints: z.number().int(),
});
export type PrizeRedeemResult = z.infer<typeof prizeRedeemResultSchema>;

export const joinRankingBodySchema = z.object({
  nickname: z
    .string()
    .trim()
    .min(3, "Use 3 letras ou mais")
    .max(20, "No máximo 20 caracteres")
    .regex(/^[\p{L}\p{N}._-]+$/u, "Só letras, números, ponto, traço e sublinhado"),
  /** Aceite do regulamento do ranking (o apelido aparece para todos). */
  accept: z.literal(true, { error: "Marque o aceite para entrar no ranking" }),
});
export type JoinRankingBody = z.infer<typeof joinRankingBodySchema>;

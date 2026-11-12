import { z } from "zod";
import { idSchema, isoDateTimeSchema } from "../common";
import {
  prizeKindSchema,
  prizeRedemptionStatusSchema,
  rankingEntrySchema,
  sealRefSchema,
} from "../gamification";

/*
 * Clube ARP. Selos são conquistas permanentes (viram histórico, não vencem).
 * Cada conquista dá Trevos, a moeda do Clube: os Trevos ganhos no ano valem
 * para troca até 31/12 daquele ano. Na lojinha o visitante troca pelo app,
 * recebe um código e retira no Mercado Local, que valida e entrega. O
 * ranking mostra só quem aceitou, só com apelido.
 */

export const clubPointsSchema = z.object({
  /** Trevos para trocar agora (nunca negativo). */
  total: z.number().int(),
  /** Até quando os Trevos valem para troca (31/12 do ano; null = sem Trevos). */
  validUntil: isoDateTimeSchema.nullable(),
  /** Próximo prêmio que ainda não dá para trocar. */
  nextPrize: z
    .object({ id: idSchema, name: z.string(), points: z.number().int(), missing: z.number().int() })
    .nullable(),
});
export type ClubPoints = z.infer<typeof clubPointsSchema>;

/**
 * active = já conquistou ao menos uma vez · none = ainda não. `expired` é
 * legado (selos não vencem mais) e não vem mais da API.
 */
export const clubSealStateSchema = z.enum(["active", "expired", "none"]);
export type ClubSealState = z.infer<typeof clubSealStateSchema>;

/** Categoria colecionável de selos (Fio Cultural, Transforma, Sabores…). */
export const clubSealSchema = z.object({
  seal: sealRefSchema,
  /** Trevos por conquista. */
  points: z.number().int(),
  repeatable: z.boolean(),
  state: clubSealStateSchema,
  /** Conquistas nesta categoria (o "02 selos" do cartão). */
  times: z.number().int(),
  /** Legado: sempre null (selos não vencem). */
  expiresAt: isoDateTimeSchema.nullable(),
  /** Última conquista (null = nenhuma). */
  lastEarnedAt: isoDateTimeSchema.nullable(),
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
  /** Como e onde retirar (vazio = o app mostra o texto padrão). */
  pickupRules: z.string(),
});
export type ClubPrize = z.infer<typeof clubPrizeSchema>;

/** Troca do visitante na lojinha. */
export const clubRedemptionSchema = z.object({
  id: idSchema,
  /** Código para mostrar no Mercado Local (6 letras). */
  code: z.string(),
  prize: z.object({ id: idSchema, name: z.string(), imageUrl: z.string().nullable() }),
  points: z.number().int(),
  status: prizeRedemptionStatusSchema,
  createdAt: isoDateTimeSchema,
  /** pending: até quando dá para retirar. */
  expiresAt: isoDateTimeSchema.nullable(),
  deliveredAt: isoDateTimeSchema.nullable(),
});
export type ClubRedemption = z.infer<typeof clubRedemptionSchema>;

export const clubSchema = z.object({
  /** null sem login. */
  points: clubPointsSchema.nullable(),
  seals: z.array(clubSealSchema),
  prizes: z.array(clubPrizeSchema),
  /** Trocas esperando retirada (vazio sem login). */
  pendingRedemptions: z.array(clubRedemptionSchema),
  ranking: z.object({
    top: z.array(rankingEntrySchema),
    /** Posição do visitante (null = não participa ou sem login). */
    me: rankingEntrySchema.nullable(),
    joined: z.boolean(),
  }),
});
export type Club = z.infer<typeof clubSchema>;

/* Extrato de Trevos -------------------------------------------------------- */

/** earned = conquista de selo (+) · redeemed = troca na lojinha (−). */
export const trevoEntryKindSchema = z.enum(["earned", "redeemed"]);
export type TrevoEntryKind = z.infer<typeof trevoEntryKindSchema>;

export const trevoEntrySchema = z.object({
  id: idSchema,
  kind: trevoEntryKindSchema,
  /** Desafio cumprido ou prêmio trocado. */
  title: z.string(),
  /** earned: o selo (categoria) da conquista. */
  seal: sealRefSchema.nullable(),
  /** Positivo ao ganhar, negativo ao trocar. */
  points: z.number().int(),
  at: isoDateTimeSchema,
  /** redeemed: situação da troca (cancelada não desconta). */
  status: prizeRedemptionStatusSchema.nullable(),
  /** redeemed: código da troca. */
  code: z.string().nullable(),
});
export type TrevoEntry = z.infer<typeof trevoEntrySchema>;

export const TREVO_STATEMENT_LIMIT = 300;

/** Do mais recente para o mais antigo (até TREVO_STATEMENT_LIMIT). */
export const trevoStatementSchema = z.object({
  total: z.number().int(),
  validUntil: isoDateTimeSchema.nullable(),
  /** Trevos ganhos no ano (antes das trocas). */
  earnedThisYear: z.number().int(),
  entries: z.array(trevoEntrySchema),
});
export type TrevoStatement = z.infer<typeof trevoStatementSchema>;

/** Resultado da troca: o código para retirar e o saldo que sobrou. */
export const redeemPrizeResultSchema = clubRedemptionSchema.extend({
  totalPoints: z.number().int(),
});
export type RedeemPrizeResult = z.infer<typeof redeemPrizeResultSchema>;

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

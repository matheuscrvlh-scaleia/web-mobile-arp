import { z } from "zod";
import {
  demoFlagSchema,
  hexColorSchema,
  iconNameSchema,
  idSchema,
  isoDateSchema,
  isoDateTimeSchema,
  listOf,
  mediaUrlSchema,
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
  /** Pontos que o selo dá no Clube ARP (Fase 2). */
  points: z.number().int(),
  /** Meses até o selo vencer; vencido, os pontos saem do total. */
  validityMonths: z.number().int(),
  /** Pode ser ganho de novo (ex.: evento). Padrão: uso único. */
  repeatable: z.boolean(),
  /** Janela em que o selo pode ser ganho (null = sem limite). */
  availableFrom: isoDateTimeSchema.nullable(),
  availableUntil: isoDateTimeSchema.nullable(),
  earnedCount: z.number().int(),
  /** Desafios que dão este selo (qualquer situação). Com algum, o selo não pode ser excluído. */
  challengesCount: z.number().int(),
  /** Desafios ativos, de campanha não arquivada e que ainda não acabou: continuam dando o selo. */
  activeChallengesCount: z.number().int(),
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
  points: z.number().int().min(1).max(1000).default(10),
  validityMonths: z.number().int().min(1).max(12).default(6),
  repeatable: z.boolean().default(false),
  availableFrom: isoDateTimeSchema.nullable().optional(),
  availableUntil: isoDateTimeSchema.nullable().optional(),
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
  isDemo: demoFlagSchema,
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

/**
 * Duplicar campanha (ex.: novembro → dezembro): nova campanha em rascunho
 * com as faixas e os desafios copiados (sem QR Codes). As janelas próprias
 * dos desafios andam junto com o início da campanha.
 */
export const duplicateCampaignBodySchema = z
  .object({
    name: campaignFields.name,
    startsAt: isoDateTimeSchema,
    endsAt: isoDateTimeSchema,
  })
  .refine(campaignDates, campaignDatesIssue);
export type DuplicateCampaignBody = z.infer<typeof duplicateCampaignBodySchema>;

/** Ordem dos desafios da campanha: todos os ids, do primeiro ao último. */
export const reorderChallengesBodySchema = z.object({ ids: z.array(idSchema).min(1).max(200) });
export type ReorderChallengesBody = z.infer<typeof reorderChallengesBodySchema>;

/* Desafios --------------------------------------------------------------- */

export const challengeValidationSchema = z.enum(["qr", "auto"]);
export type ChallengeValidation = z.infer<typeof challengeValidationSchema>;
export const challengeStatusSchema = z.enum(["active", "inactive"]);
/**
 * O que dá o selo num desafio automático: a loja dar baixa num cupom no
 * caixa, ou um sistema externo (ex.: estacionamento pago pelo app).
 */
export const challengeAutoTriggerSchema = z.enum(["coupon_redeemed", "integration"]);
export type ChallengeAutoTrigger = z.infer<typeof challengeAutoTriggerSchema>;

export const challengeSchema = z.object({
  id: idSchema,
  campaign: refSchema,
  seal: sealRefSchema,
  title: z.string(),
  /** Como cumprir (ex.: "QR Code no fim do tour, na praça central"). */
  howTo: z.string(),
  icon: iconNameSchema,
  validation: challengeValidationSchema,
  /** Só no automático. */
  autoTrigger: challengeAutoTriggerSchema.nullable(),
  /** Cupom cuja baixa no caixa dá o selo (gatilho coupon_redeemed). */
  coupon: z.object({ id: idSchema, title: z.string(), storeName: z.string() }).nullable(),
  store: refSchema.nullable(),
  /** Desafio de produto do parceiro (ex.: "Prato do mês"). */
  product: z.string().nullable(),
  event: z.object({ id: idSchema, title: z.string() }).nullable(),
  sortOrder: z.number().int(),
  status: challengeStatusSchema,
  /** Janela própria dentro da campanha (null = início/fim da campanha). */
  availableFrom: isoDateTimeSchema.nullable(),
  availableUntil: isoDateTimeSchema.nullable(),
  completionsCount: z.number().int(),
  qrCodesCount: z.number().int(),
  isDemo: demoFlagSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});
export type Challenge = z.infer<typeof challengeSchema>;
export const challengeListSchema = listOf(challengeSchema);

export const createChallengeBodySchema = z.object({
  campaignId: z.uuid({ error: "Escolha a campanha" }),
  sealId: z.uuid({ error: "Escolha o selo" }),
  title: z.string().trim().min(3).max(120),
  howTo: z.string().trim().min(3).max(240),
  icon: iconNameSchema,
  validation: challengeValidationSchema,
  /** Obrigatório no automático; ignorado no QR. */
  autoTrigger: challengeAutoTriggerSchema.nullable().optional(),
  /** Obrigatório no gatilho coupon_redeemed (a loja do desafio passa a ser a do cupom). */
  couponId: idSchema.nullable().optional(),
  storeId: idSchema.nullable().optional(),
  /** Produto do parceiro (desafio de produto; o lojista gera o QR). */
  product: z.string().trim().max(80).nullable().optional(),
  eventId: idSchema.nullable().optional(),
  /** Sem ordem: entra no fim da lista da campanha (a ordem muda arrastando). */
  sortOrder: z.number().int().min(0).max(999).optional(),
  status: challengeStatusSchema.default("active"),
  /** Vazio: vale o início/fim da campanha. */
  availableFrom: isoDateTimeSchema.nullable().optional(),
  availableUntil: isoDateTimeSchema.nullable().optional(),
});
export type CreateChallengeBody = z.infer<typeof createChallengeBodySchema>;
export const updateChallengeBodySchema = z.object(
  patchOf(createChallengeBodySchema.omit({ campaignId: true }).shape),
);
export type UpdateChallengeBody = z.infer<typeof updateChallengeBodySchema>;

export const listChallengesQuerySchema = z.object({
  campaignId: idSchema.optional(),
  /** Desafios que dão selo na baixa deste cupom. */
  couponId: idSchema.optional(),
});
export type ListChallengesQuery = z.infer<typeof listChallengesQuerySchema>;

/* QR Codes --------------------------------------------------------------- */

export const qrCodeStatusSchema = z.enum(["active", "revoked"]);

/**
 * Prazos sugeridos do QR (Fase 2): todo QR Code tem prazo. Fixo = vale até
 * criado + prazo. Telão (rotating) = troca sozinho a cada prazo e o código
 * anterior deixa de valer (print não serve).
 */
export const QR_TTL_OPTIONS = [
  { seconds: 45, label: "45 segundos" },
  { seconds: 300, label: "5 minutos" },
  { seconds: 3600, label: "1 hora" },
  { seconds: 86_400, label: "24 horas" },
  { seconds: 3 * 86_400, label: "3 dias" },
  { seconds: 7 * 86_400, label: "7 dias (o máximo)" },
] as const;
export const qrTtlSecondsSchema = z
  .number()
  .int()
  .min(15)
  .max(7 * 86_400);

export const qrCodeSchema = z.object({
  id: idSchema,
  challengeId: idSchema,
  label: z.string(),
  /**
   * Texto codificado no QR (ex.: arp://selo/<token>). No modo telão, é o
   * código da janela atual; use GET /qr-codes/:id/current para renovar.
   */
  payload: z.string(),
  validFrom: isoDateTimeSchema.nullable(),
  validUntil: isoDateTimeSchema.nullable(),
  /** Prazo de cada código (s). */
  ttlSeconds: z.number().int(),
  /** Modo telão: renova sozinho a cada ttlSeconds. */
  rotating: z.boolean(),
  /** Quem gerou (pessoa da ARP ou lojista). */
  createdBy: refSchema.nullable(),
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
  /** Prazo obrigatório (não existe QR sem prazo). */
  ttlSeconds: qrTtlSecondsSchema,
  rotating: z.boolean().default(false),
  validFrom: isoDateTimeSchema.nullable().optional(),
});
export type CreateQrCodeBody = z.infer<typeof createQrCodeBodySchema>;

/**
 * Por que o QR não dá selo agora, mesmo com código válido: desafio pausado,
 * campanha fora do app, ainda não começou ou já acabou (null = dá selo).
 */
export const qrBlockedSchema = z.enum(["paused", "unpublished", "not_started", "ended"]);
export type QrBlocked = z.infer<typeof qrBlockedSchema>;

/** Código para mostrar agora (telão renova quando `expiresAt` passa). */
export const qrCurrentSchema = z.object({
  payload: z.string(),
  expiresAt: isoDateTimeSchema,
  ttlSeconds: z.number().int(),
  rotating: z.boolean(),
  /** Revogado: o telão avisa em vez de mostrar um código que não vale. */
  status: qrCodeStatusSchema,
  /** Para o telão dizer o que o visitante ganha. */
  label: z.string(),
  challenge: z.object({ id: idSchema, title: z.string(), howTo: z.string() }),
  seal: sealRefSchema,
  campaign: refSchema,
  blocked: qrBlockedSchema.nullable(),
  /** Quando o desafio começa a dar selo (campanha ou janela própria). */
  startsAt: isoDateTimeSchema,
});
export type QrCurrent = z.infer<typeof qrCurrentSchema>;

/** O prazo não muda depois de gerado: para outro prazo, gere outro QR. */
export const updateQrCodeBodySchema = z.object({
  label: z.string().trim().min(2).max(60).optional(),
  status: qrCodeStatusSchema.optional(),
  validFrom: isoDateTimeSchema.nullable().optional(),
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
  isDemo: demoFlagSchema,
});
export type EarnedSeal = z.infer<typeof earnedSealSchema>;
export const earnedSealPageSchema = paginated(earnedSealSchema);

/* Lojinha do Clube ARP (Fase 2) ------------------------------------------ */

/** souvenir = da ARP · artist = peça de artista · partner = item de parceiro. */
export const prizeKindSchema = z.enum(["souvenir", "artist", "partner"]);
export type PrizeKind = z.infer<typeof prizeKindSchema>;
export const PRIZE_KIND_LABEL: Record<PrizeKind, string> = {
  souvenir: "Souvenir da ARP",
  artist: "Peça de artista",
  partner: "Item de parceiro",
};

export const prizeSchema = z.object({
  id: idSchema,
  name: z.string(),
  description: z.string(),
  kind: prizeKindSchema,
  points: z.number().int(),
  /** Unidades disponíveis; 0 = sai da lojinha. */
  stock: z.number().int(),
  imageUrl: z.string().nullable(),
  active: z.boolean(),
  sortOrder: z.number().int(),
  redeemedCount: z.number().int(),
  /** Visitantes com pontos para trocar agora (para a ARP saber quantos comprar). */
  visitorsEnough: z.number().int(),
  /** Visitantes com 80% ou mais dos pontos. */
  visitorsAlmost: z.number().int(),
  isDemo: demoFlagSchema,
});
export type Prize = z.infer<typeof prizeSchema>;
export const prizeListSchema = listOf(prizeSchema);

export const createPrizeBodySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Escreva o nome do prêmio (2 letras ou mais)")
    .max(80, "No máximo 80 letras"),
  description: z.string().trim().max(300).default(""),
  kind: prizeKindSchema,
  points: z
    .number({ error: "Quantos pontos custa?" })
    .int("Use pontos inteiros")
    .min(1, "Custa pelo menos 1 ponto")
    .max(100_000, "No máximo 100.000 pontos"),
  stock: z
    .number({ error: "Quantas unidades tem?" })
    .int("Use um número inteiro")
    .min(0, "O estoque não pode ser negativo")
    .max(100_000, "No máximo 100.000"),
  imageUrl: mediaUrlSchema.nullable().default(null),
  active: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(999).default(0),
});
export type CreatePrizeBody = z.infer<typeof createPrizeBodySchema>;
export const updatePrizeBodySchema = z.object(patchOf(createPrizeBodySchema.shape));
export type UpdatePrizeBody = z.infer<typeof updatePrizeBodySchema>;

/**
 * A troca só acontece no balcão (o app não pede): sai entregue na hora.
 * Cancelada = o Centro de Informações desfez (pontos e estoque voltam).
 */
export const prizeRedemptionStatusSchema = z.enum(["delivered", "cancelled"]);
export type PrizeRedemptionStatus = z.infer<typeof prizeRedemptionStatusSchema>;

export const prizeRedemptionSchema = z.object({
  id: idSchema,
  /** Comprovante da troca (6 letras). */
  code: z.string(),
  prize: refSchema,
  visitor: refSchema,
  points: z.number().int(),
  status: prizeRedemptionStatusSchema,
  createdAt: isoDateTimeSchema,
  deliveredAt: isoDateTimeSchema.nullable(),
  /** Quem fez a troca no balcão (null = usuário apagado). */
  deliveredBy: refSchema.nullable(),
  cancelledAt: isoDateTimeSchema.nullable(),
  isDemo: demoFlagSchema,
});
export type PrizeRedemption = z.infer<typeof prizeRedemptionSchema>;
export const prizeRedemptionPageSchema = paginated(prizeRedemptionSchema);
export const listPrizeRedemptionsQuerySchema = paginationQuerySchema.extend({
  status: prizeRedemptionStatusSchema.optional(),
  /** Comprovante ou nome do visitante. */
  q: z.string().trim().max(120).optional(),
});
export type ListPrizeRedemptionsQuery = z.infer<typeof listPrizeRedemptionsQuerySchema>;

/* Troca no balcão: o Centro de Informações acha o visitante e troca por ele. */

export const redemptionVisitorsQuerySchema = z.object({
  /** Nome, e-mail ou telefone. */
  q: z.string().trim().min(2, "Digite 2 letras ou mais").max(120),
});
export type RedemptionVisitorsQuery = z.infer<typeof redemptionVisitorsQuerySchema>;

export const redemptionVisitorSchema = z.object({
  id: idSchema,
  name: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  blocked: z.boolean(),
  /** Saldo do Clube agora (selos valendo menos trocas). */
  points: z.number().int(),
});
export type RedemptionVisitor = z.infer<typeof redemptionVisitorSchema>;
export const redemptionVisitorListSchema = listOf(redemptionVisitorSchema);

export const counterRedeemBodySchema = z.object({
  visitorId: idSchema,
  prizeId: idSchema,
});
export type CounterRedeemBody = z.infer<typeof counterRedeemBodySchema>;

/** Troca já entregue + saldo que sobrou. */
export const counterRedeemResultSchema = prizeRedemptionSchema.extend({
  totalPoints: z.number().int(),
});
export type CounterRedeemResult = z.infer<typeof counterRedeemResultSchema>;

/** Ranking de visitantes (só quem aceitou, só com apelido). */
export const rankingEntrySchema = z.object({
  position: z.number().int(),
  nickname: z.string(),
  points: z.number().int(),
});
export type RankingEntry = z.infer<typeof rankingEntrySchema>;
export const rankingListSchema = listOf(rankingEntrySchema);

/** Selos dados por loja, desafio (produto) e período: base da cobrança do lojista. */
export const sealsReportQuerySchema = z.object({
  from: isoDateSchema,
  to: isoDateSchema,
  storeId: idSchema.optional(),
});
export type SealsReportQuery = z.infer<typeof sealsReportQuerySchema>;
export const sealsReportRowSchema = z.object({
  store: refSchema.nullable(),
  challenge: refSchema,
  product: z.string().nullable(),
  seal: refSchema,
  count: z.number().int(),
});
export type SealsReportRow = z.infer<typeof sealsReportRowSchema>;
export const sealsReportSchema = listOf(sealsReportRowSchema);

export const listEarnedSealsQuerySchema = paginationQuerySchema.extend({
  campaignId: idSchema.optional(),
  challengeId: idSchema.optional(),
  visitorId: idSchema.optional(),
});
export type ListEarnedSealsQuery = z.infer<typeof listEarnedSealsQuerySchema>;

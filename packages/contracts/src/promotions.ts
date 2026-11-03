import { z } from "zod";
import {
  ALL_WEEKDAYS,
  centsSchema,
  couponToneSchema,
  cursorQuerySchema,
  hexColorSchema,
  iconNameSchema,
  idSchema,
  isoDateSchema,
  isoDateTimeSchema,
  listOf,
  mediaUrlSchema,
  paginated,
  paginationQuerySchema,
  refSchema,
  weekdaysSchema,
} from "./common";
import { storeKindSchema } from "./directory";

/*
 * Regras do cupom (vindas do app):
 * - O lojista libera N unidades (totalQuantity). Nunca passa disso.
 * - Pegar gera um código único (ARP-XXXXXX) com prazo de uso
 *   (redeemWindowHours, contado a partir de quando pegou).
 * - Não usou no prazo? O pego expira e a unidade volta para a promoção.
 * - Um visitante só tem um pego ativo por cupom.
 * - Restantes = total − (ativos dentro do prazo + usados).
 */

export const COUPON_CODE_PATTERN = /^ARP-[A-Z0-9]{6}$/;

/**
 * Revisão da ARP (Fase 2): cupom criado ou editado pelo lojista fica
 * "pending" até alguém com coupons.approve aprovar. Só "approved" vai ao app.
 * Cupom criado pela equipe da ARP já nasce aprovado.
 */
export const couponReviewSchema = z.enum(["pending", "approved", "rejected"]);
export type CouponReview = z.infer<typeof couponReviewSchema>;
export const COUPON_REVIEW_LABEL: Record<CouponReview, string> = {
  pending: "Aguardando ARP",
  approved: "Aprovado",
  rejected: "Recusado",
};
export const couponCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(COUPON_CODE_PATTERN, "Código no formato ARP-XXXXXX");

export const couponStatusSchema = z.enum(["draft", "active", "paused", "ended"]);
export type CouponStatus = z.infer<typeof couponStatusSchema>;

export const claimStatusSchema = z.enum(["active", "redeemed", "expired", "cancelled"]);
export type ClaimStatus = z.infer<typeof claimStatusSchema>;

export const couponStockSchema = z.object({
  total: z.number().int(),
  /** Ativos dentro do prazo, aguardando uso no caixa. */
  waiting: z.number().int(),
  redeemed: z.number().int(),
  /** Venceram sem uso (voltaram para a promoção). */
  returned: z.number().int(),
  remaining: z.number().int(),
});
export type CouponStock = z.infer<typeof couponStockSchema>;

export const couponStoreRefSchema = z.object({
  id: idSchema,
  name: z.string(),
  icon: iconNameSchema,
  brandColor: hexColorSchema,
  kind: storeKindSchema,
});

export const couponSchema = z.object({
  id: idSchema,
  store: couponStoreRefSchema,
  title: z.string(),
  /** Destaque grande do cartão (ex.: "R$ 5", "15%", "Grátis"). */
  headline: z.string(),
  /** Complemento do destaque (ex.: "o chopp", "OFF"). */
  headlineSub: z.string().nullable(),
  description: z.string().nullable(),
  /** Quando vale, em texto livre (ex.: "Seg a sex, 11h às 15h"). */
  scheduleNote: z.string().nullable(),
  startsAt: isoDateTimeSchema,
  endsAt: isoDateTimeSchema.nullable(),
  totalQuantity: z.number().int(),
  redeemWindowHours: z.number().int(),
  tone: couponToneSchema,
  icon: iconNameSchema,
  imageUrl: z.string().nullable(),
  /** Economia estimada por uso (para o "você economizou" do app). */
  savingsCents: z.number().int().nullable(),
  status: couponStatusSchema,
  /** Dias em que pode ser usado (0 = domingo). */
  weekdays: z.array(z.number().int()),
  review: couponReviewSchema,
  /** Motivo da recusa (o lojista vê). */
  reviewNote: z.string().nullable(),
  stock: couponStockSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});
export type Coupon = z.infer<typeof couponSchema>;
export const couponPageSchema = paginated(couponSchema);

const couponFields = {
  storeId: idSchema,
  title: z.string().trim().min(3).max(120),
  headline: z.string().trim().min(1).max(16),
  headlineSub: z.string().trim().max(24).nullable().optional(),
  description: z.string().trim().max(600).nullable().optional(),
  scheduleNote: z.string().trim().max(80).nullable().optional(),
  startsAt: isoDateTimeSchema,
  endsAt: isoDateTimeSchema.nullable().optional(),
  totalQuantity: z.number().int().min(1).max(100_000),
  redeemWindowHours: z.number().int().min(1).max(720),
  tone: couponToneSchema,
  icon: iconNameSchema,
  imageUrl: mediaUrlSchema.nullable().optional(),
  savingsCents: centsSchema.nullable().optional(),
  /** Dias em que pode ser usado; fora deles, a validação recusa. Padrão: todos. */
  weekdays: weekdaysSchema.default([...ALL_WEEKDAYS]),
};

const endsAfterStart = (v: { startsAt?: string; endsAt?: string | null }) =>
  !v.startsAt || !v.endsAt || new Date(v.endsAt) > new Date(v.startsAt);
const endsAfterStartIssue = {
  message: "O fim precisa ser depois do início",
  path: ["endsAt"],
};

export const createCouponBodySchema = z
  .object({ ...couponFields, status: z.enum(["draft", "active"]).default("draft") })
  .refine(endsAfterStart, endsAfterStartIssue);
export type CreateCouponBody = z.infer<typeof createCouponBodySchema>;
export type CreateCouponInput = z.input<typeof createCouponBodySchema>;

/** Não dá para baixar o total abaixo do que já foi pego (regra no domínio). */
export const updateCouponBodySchema = z
  .object({ ...couponFields, weekdays: weekdaysSchema })
  .omit({ storeId: true })
  .partial()
  .refine(endsAfterStart, endsAfterStartIssue);
export type UpdateCouponBody = z.infer<typeof updateCouponBodySchema>;

export const changeCouponStatusBodySchema = z.object({ status: couponStatusSchema });
export type ChangeCouponStatusBody = z.infer<typeof changeCouponStatusBodySchema>;

/** Aprovar ou recusar (com motivo) o cupom do lojista. */
export const reviewCouponBodySchema = z
  .object({
    decision: z.enum(["approve", "reject"]),
    note: z.string().trim().max(300).optional(),
  })
  .refine((b) => b.decision === "approve" || (b.note ?? "").length > 0, {
    message: "Diga ao lojista o motivo da recusa",
    path: ["note"],
  });
export type ReviewCouponBody = z.infer<typeof reviewCouponBodySchema>;

export const listCouponsQuerySchema = paginationQuerySchema.extend({
  storeId: idSchema.optional(),
  status: couponStatusSchema.optional(),
  review: couponReviewSchema.optional(),
  kind: storeKindSchema.optional(),
});
export type ListCouponsQuery = z.infer<typeof listCouponsQuerySchema>;

/* Cupons pegos (claims) -------------------------------------------------- */

export const couponClaimSchema = z.object({
  id: idSchema,
  code: z.string(),
  status: claimStatusSchema,
  claimedAt: isoDateTimeSchema,
  expiresAt: isoDateTimeSchema,
  redeemedAt: isoDateTimeSchema.nullable(),
  coupon: z.object({ id: idSchema, title: z.string(), headline: z.string() }),
  store: refSchema,
  visitor: refSchema,
  redeemedBy: refSchema.nullable(),
});
export type CouponClaim = z.infer<typeof couponClaimSchema>;
export const couponClaimPageSchema = paginated(couponClaimSchema);

export const listClaimsQuerySchema = paginationQuerySchema.extend({
  ...cursorQuerySchema.shape,
  couponId: idSchema.optional(),
  storeId: idSchema.optional(),
  visitorId: idSchema.optional(),
  status: claimStatusSchema.optional(),
});
export type ListClaimsQuery = z.infer<typeof listClaimsQuerySchema>;

/** Consulta o código antes de confirmar o uso no caixa. */
export const lookupClaimQuerySchema = z.object({ code: couponCodeSchema });
export type LookupClaimQuery = z.infer<typeof lookupClaimQuerySchema>;

/**
 * Valida (usa) o código no caixa. Erros possíveis: NOT_FOUND,
 * CLAIM_ALREADY_REDEEMED (409), CLAIM_EXPIRED (410), CLAIM_CANCELLED (409),
 * CLAIM_WRONG_STORE (403, lojista tentando validar cupom de outra loja).
 */
export const redeemClaimBodySchema = z.object({ code: couponCodeSchema });
export type RedeemClaimBody = z.infer<typeof redeemClaimBodySchema>;

/** Relatório: cupons pegos e usados por loja no período (dias em São Paulo). */
export const couponsByStoreQuerySchema = z.object({ from: isoDateSchema, to: isoDateSchema });
export type CouponsByStoreQuery = z.infer<typeof couponsByStoreQuerySchema>;
export const couponsByStoreRowSchema = z.object({
  store: refSchema,
  claimed: z.number().int(),
  used: z.number().int(),
});
export type CouponsByStoreRow = z.infer<typeof couponsByStoreRowSchema>;
export const couponsByStoreSchema = listOf(couponsByStoreRowSchema);

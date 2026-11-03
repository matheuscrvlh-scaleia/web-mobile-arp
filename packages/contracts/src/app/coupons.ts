import { z } from "zod";
import {
  couponToneSchema,
  hexColorSchema,
  iconNameSchema,
  idSchema,
  isoDateTimeSchema,
  paginated,
  paginationQuerySchema,
} from "../common";
import { storeKindSchema } from "../directory";

/** Loja resumida dentro de cartões (cupom, pino, carteira). */
export const storeRefSchema = z.object({
  id: idSchema,
  slug: z.string(),
  name: z.string(),
  icon: iconNameSchema,
  brandColor: hexColorSchema,
  kind: storeKindSchema,
});
export type StoreRef = z.infer<typeof storeRefSchema>;

/** Loja citada em outro conteúdo (evento, desafio): o slug abre a página da loja. */
export const storeLinkSchema = z.object({ id: idSchema, slug: z.string(), name: z.string() });
export type StoreLink = z.infer<typeof storeLinkSchema>;

export const couponStockSchema = z.object({
  total: z.number().int(),
  /** total − (pegos dentro do prazo + usados). */
  remaining: z.number().int(),
});

/** Cupom no ar (vitrine, home, página da loja). */
export const couponCardSchema = z.object({
  id: idSchema,
  store: storeRefSchema,
  title: z.string(),
  headline: z.string(),
  headlineSub: z.string().nullable(),
  description: z.string().nullable(),
  scheduleNote: z.string().nullable(),
  startsAt: isoDateTimeSchema,
  endsAt: isoDateTimeSchema.nullable(),
  /** Prazo para usar depois de pegar. */
  redeemWindowHours: z.number().int(),
  tone: couponToneSchema,
  icon: iconNameSchema,
  imageUrl: z.string().nullable(),
  savingsCents: z.number().int().nullable(),
  /** Dias em que pode ser usado (0 = domingo); ver weekdaysLabel. */
  weekdays: z.array(z.number().int()),
  stock: couponStockSchema,
});
export type CouponCard = z.infer<typeof couponCardSchema>;
export const couponPageSchema = paginated(couponCardSchema);

export const listCouponsQuerySchema = paginationQuerySchema.extend({
  kind: storeKindSchema.optional(),
  storeId: idSchema.optional(),
  /** "Acabando": ordena pelos que têm menos unidades restantes (proporcionalmente). */
  sort: z.enum(["ending", "newest"]).default("newest"),
});
export type ListCouponsQuery = z.infer<typeof listCouponsQuerySchema>;

/**
 * Situação do cupom pego, do ponto de vista do visitante: um pego ativo
 * cujo prazo passou aparece como "expired" (a unidade já voltou para a promoção).
 */
export const walletStatusSchema = z.enum(["active", "used", "expired", "cancelled"]);
export type WalletStatus = z.infer<typeof walletStatusSchema>;

export const claimSchema = z.object({
  id: idSchema,
  code: z.string(),
  status: walletStatusSchema,
  claimedAt: isoDateTimeSchema,
  expiresAt: isoDateTimeSchema,
  redeemedAt: isoDateTimeSchema.nullable(),
  coupon: z.object({
    id: idSchema,
    title: z.string(),
    headline: z.string(),
    headlineSub: z.string().nullable(),
    scheduleNote: z.string().nullable(),
    tone: couponToneSchema,
    icon: iconNameSchema,
    imageUrl: z.string().nullable(),
    savingsCents: z.number().int().nullable(),
    /** Dias em que pode ser usado: "Meu cupom" avisa quando hoje não é dia. */
    weekdays: z.array(z.number().int()),
  }),
  store: storeRefSchema,
});
export type Claim = z.infer<typeof claimSchema>;

export const couponDetailSchema = couponCardSchema.extend({
  /** Pego ativo do visitante logado (null sem login ou sem pego ativo). */
  myClaim: claimSchema.nullable(),
});
export type CouponDetail = z.infer<typeof couponDetailSchema>;

/* Carteira --------------------------------------------------------------- */

export const walletTabSchema = z.enum(["active", "used", "expired"]);
export type WalletTab = z.infer<typeof walletTabSchema>;

export const walletQuerySchema = z.object({
  tab: walletTabSchema.default("active"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type WalletQuery = z.infer<typeof walletQuerySchema>;

export const walletSchema = paginated(claimSchema).extend({
  counts: z.object({
    active: z.number().int(),
    used: z.number().int(),
    expired: z.number().int(),
  }),
});
export type Wallet = z.infer<typeof walletSchema>;

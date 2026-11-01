import { z } from "zod";
import { authUserSchema, loginBodySchema } from "../auth";
import {
  hexColorSchema,
  iconNameSchema,
  idSchema,
  isoDateSchema,
  isoDateTimeSchema,
  refSchema,
} from "../common";
import type { Permission } from "../permissions";
import { claimStatusSchema, couponCodeSchema } from "../promotions";
import { refreshBodySchema } from "./auth";

/*
 * Painel do lojista dentro do app (/api/v1/app/merchant/*). Quem entra são
 * usuários do PAINEL (identity.users) com `coupons.redeem`, não visitantes.
 *
 * Tokens: o access token é o MESMO do painel (JWT aud "admin", com cargo,
 * permissões e loja): vai no header Authorization e também abre as rotas do
 * painel que o usuário já tem (ex.: POST /api/v1/auth/change-password). O
 * refresh token vai no CORPO de refresh/logout (o app guarda no
 * armazenamento seguro do aparelho), como na conta do visitante.
 *
 * Loja: usuário com loja (lojista) age só sobre ela e pode omitir `storeId`.
 * Usuário sem loja (administrador, atendimento) enxerga todas as lojas ativas
 * (`allStores: true` na sessão) e manda `storeId` em cada chamada — omitir só
 * vale quando existe uma única loja ativa.
 *
 * Erros: login → INVALID_CREDENTIALS (401, genérico, inclusive usuário
 * desativado), FORBIDDEN (403, senha certa mas sem `coupons.redeem` ou sem
 * loja); refresh → UNAUTHENTICATED (401) ou FORBIDDEN (403, perdeu o
 * acesso; a sessão é encerrada). Caixa → NOT_FOUND, CLAIM_ALREADY_REDEEMED
 * (409), CLAIM_EXPIRED (410), CLAIM_CANCELLED (409), CLAIM_WRONG_STORE (403);
 * `storeId` faltando → VALIDATION_ERROR; loja de outro lojista → FORBIDDEN.
 */

export interface MerchantRouteDef {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Relativo a APP_API_PREFIX (/api/v1/app). */
  path: string;
  permission: Permission | null;
  public?: true;
  summary: string;
}

const m = (
  method: MerchantRouteDef["method"],
  path: string,
  permission: Permission | null,
  summary: string,
  extra: { public?: true } = {},
): MerchantRouteDef => ({ method, path, permission, summary, ...extra });

const open = { public: true } as const;

export const MERCHANT_ROUTES = {
  auth: {
    login: m("POST", "/merchant/auth/login", null, "Lojista: entrar (e-mail e senha)", open),
    refresh: m("POST", "/merchant/auth/refresh", null, "Lojista: renovar sessão (corpo)", open),
    logout: m("POST", "/merchant/auth/logout", null, "Lojista: sair (revoga o refresh)", open),
  },
  claims: {
    lookup: m("GET", "/merchant/claims/lookup", "coupons.redeem", "Lojista: consultar código"),
    redeem: m("POST", "/merchant/claims/redeem", "coupons.redeem", "Lojista: usar código no caixa"),
  },
  overview: m("GET", "/merchant/overview", "coupons.view", "Lojista: números da loja"),
} as const;

/* Sessão ----------------------------------------------------------------- */

export const merchantLoginBodySchema = loginBodySchema;
export type MerchantLoginBody = z.infer<typeof merchantLoginBodySchema>;

/** Refresh e logout: o token opaco vai no corpo. */
export const merchantRefreshBodySchema = refreshBodySchema;
export type MerchantRefreshBody = z.infer<typeof merchantRefreshBodySchema>;

export const merchantStoreSchema = z.object({
  id: idSchema,
  slug: z.string(),
  name: z.string(),
  icon: iconNameSchema,
  brandColor: hexColorSchema,
});
export type MerchantStore = z.infer<typeof merchantStoreSchema>;

export const merchantSessionSchema = z.object({
  accessToken: z.string(),
  /** Segundos até o access token expirar. */
  expiresIn: z.number().int(),
  refreshToken: z.string(),
  refreshExpiresAt: isoDateTimeSchema,
  /** Mesmo usuário do /auth/me do painel (permissões e `mustChangePassword` inclusos). */
  user: authUserSchema,
  /** Lojas em que pode agir (lojista: só a dele; sem loja: as ativas, por nome). */
  stores: z.array(merchantStoreSchema),
  /** true = usuário sem loja: mande `storeId` nas chamadas (salvo se só houver uma loja). */
  allStores: z.boolean(),
});
export type MerchantSession = z.infer<typeof merchantSessionSchema>;

/* Caixa ------------------------------------------------------------------ */

const storeIdParam = { storeId: idSchema.optional() };

export const merchantLookupQuerySchema = z.object({ code: couponCodeSchema, ...storeIdParam });
export type MerchantLookupQuery = z.infer<typeof merchantLookupQuerySchema>;

export const merchantRedeemBodySchema = z.object({ code: couponCodeSchema, ...storeIdParam });
export type MerchantRedeemBody = z.infer<typeof merchantRedeemBodySchema>;

/** Pego visto do caixa: do visitante, só o primeiro nome (sem e-mail, telefone ou id). */
export const merchantClaimSchema = z.object({
  id: idSchema,
  code: z.string(),
  status: claimStatusSchema,
  claimedAt: isoDateTimeSchema,
  expiresAt: isoDateTimeSchema,
  redeemedAt: isoDateTimeSchema.nullable(),
  coupon: z.object({ id: idSchema, title: z.string(), headline: z.string() }),
  store: refSchema,
  visitor: z.object({ firstName: z.string() }),
});
export type MerchantClaim = z.infer<typeof merchantClaimSchema>;

/* Números da loja -------------------------------------------------------- */

/**
 * Janelas em dias de calendário de São Paulo terminando hoje (inclusive):
 * today = hoje; week = últimos 7 dias; month = últimos 30 dias (as mesmas
 * janelas de 7d/30d do dashboard do painel).
 */
export const merchantPeriodSchema = z.enum(["today", "week", "month"]);
export type MerchantPeriod = z.infer<typeof merchantPeriodSchema>;

export const merchantOverviewQuerySchema = z.object({
  period: merchantPeriodSchema.default("today"),
  ...storeIdParam,
});
export type MerchantOverviewQuery = z.infer<typeof merchantOverviewQuerySchema>;

/** Cupom no ar com o estoque desde o início da promoção (não depende do período). */
export const merchantCouponStatsSchema = z.object({
  id: idSchema,
  title: z.string(),
  headline: z.string(),
  startsAt: isoDateTimeSchema,
  endsAt: isoDateTimeSchema.nullable(),
  /** Unidades liberadas. */
  total: z.number().int(),
  /** Pegos desde o início (qualquer situação). */
  claimed: z.number().int(),
  /** Usados no caixa. */
  redeemed: z.number().int(),
  /** Pegos dentro do prazo, aguardando uso. */
  waiting: z.number().int(),
  /** Venceram sem uso: a unidade voltou para a promoção. */
  returned: z.number().int(),
  /** Livres agora = total − (aguardando + usados). */
  remaining: z.number().int(),
});
export type MerchantCouponStats = z.infer<typeof merchantCouponStatsSchema>;

export const merchantOverviewSchema = z.object({
  period: merchantPeriodSchema,
  /** Primeiro e último dia (São Paulo) da janela. */
  from: isoDateSchema,
  to: isoDateSchema,
  store: merchantStoreSchema,
  /** Cupons ativos e dentro da vigência agora, do mais recente para o mais antigo. */
  coupons: z.array(merchantCouponStatsSchema),
  /** Usos no período por hora do dia (0–23, hora de São Paulo), sempre 24 linhas. */
  redemptionsByHour: z.array(z.object({ hour: z.number().int(), count: z.number().int() })),
  /** Últimos usos do período (até 10), código mascarado (ex.: ARP-***4HX). */
  lastRedemptions: z.array(z.object({ code: z.string(), redeemedAt: isoDateTimeSchema })),
});
export type MerchantOverview = z.infer<typeof merchantOverviewSchema>;

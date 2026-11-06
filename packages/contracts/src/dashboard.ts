import { z } from "zod";
import { demoFlagSchema, idSchema, isoDateSchema, refSchema } from "./common";
import { sealRefSchema } from "./gamification";

export const dashboardPeriodSchema = z.enum(["7d", "30d", "90d"]);
export type DashboardPeriod = z.infer<typeof dashboardPeriodSchema>;

export const dashboardQuerySchema = z.object({
  period: dashboardPeriodSchema.default("30d"),
  /** Lojista sempre vê só a própria loja (o servidor força). */
  storeId: idSchema.optional(),
});
export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;

const kpi = z.object({
  value: z.number(),
  /** Mesmo indicador no período anterior de mesmo tamanho (para a variação). */
  previous: z.number().nullable(),
});
export type Kpi = z.infer<typeof kpi>;

export const dashboardOverviewSchema = z.object({
  period: dashboardPeriodSchema,
  /**
   * Há dados fictícios de demonstração no banco (is_demo): os cartões que
   * somam atividade de visitantes mostram o ícone de "inclui dados fictícios".
   */
  hasDemoData: z.boolean().optional(),
  kpis: z.object({
    visitorsTotal: kpi,
    visitorsNew: kpi,
    couponsClaimed: kpi,
    couponsRedeemed: kpi,
    /** 0..1: usados / pegos no período. */
    redemptionRate: kpi,
    sealsAwarded: kpi,
    /** Centavos: soma da economia estimada dos cupons usados. */
    savingsCents: kpi,
    activeCoupons: kpi,
    upcomingEvents: kpi,
  }),
  /** Uma linha por dia do período (fuso America/Sao_Paulo). */
  daily: z.array(
    z.object({
      date: isoDateSchema,
      claims: z.number().int(),
      redemptions: z.number().int(),
      signups: z.number().int(),
      seals: z.number().int(),
    }),
  ),
  redemptionsByHour: z.array(z.object({ hour: z.number().int(), count: z.number().int() })),
  topStores: z.array(
    z.object({ store: refSchema, claims: z.number().int(), redemptions: z.number().int() }),
  ),
  topCoupons: z.array(
    z.object({
      coupon: z.object({ id: idSchema, title: z.string() }),
      store: refSchema,
      claims: z.number().int(),
      redemptions: z.number().int(),
      remaining: z.number().int(),
      isDemo: demoFlagSchema,
    }),
  ),
  sealsByChallenge: z.array(
    z.object({
      challenge: z.object({ id: idSchema, title: z.string() }),
      seal: sealRefSchema,
      count: z.number().int(),
    }),
  ),
  scanOutcomes: z.object({
    awarded: z.number().int(),
    duplicate: z.number().int(),
    expired: z.number().int(),
    invalid: z.number().int(),
  }),
});
export type DashboardOverview = z.infer<typeof dashboardOverviewSchema>;

/* De onde vem cada indicador (modal ao clicar no cartão) ---------------- */

export const dashboardMetricSchema = z.enum([
  "visitorsTotal",
  "visitorsNew",
  "couponsClaimed",
  "couponsRedeemed",
  "redemptionRate",
  "savingsCents",
  "sealsAwarded",
  "activeCoupons",
  "upcomingEvents",
]);
export type DashboardMetric = z.infer<typeof dashboardMetricSchema>;

export const dashboardDetailQuerySchema = dashboardQuerySchema.extend({
  metric: dashboardMetricSchema,
});
export type DashboardDetailQuery = z.infer<typeof dashboardDetailQuerySchema>;

/**
 * Como o web mostra a célula: texto, inteiro, centavos, fração 0..1, dia
 * (YYYY-MM-DD) ou mês (YYYY-MM). Valor cru: a formatação fica no web.
 */
export const detailColumnKindSchema = z.enum(["text", "int", "cents", "percent", "day", "month"]);
export type DetailColumnKind = z.infer<typeof detailColumnKindSchema>;

export const dashboardDetailTableSchema = z.object({
  title: z.string(),
  columns: z.array(z.object({ title: z.string(), kind: detailColumnKindSchema })),
  rows: z.array(
    z.object({
      id: z.string(),
      cells: z.array(z.union([z.string(), z.number(), z.null()])),
    }),
  ),
});
export type DashboardDetailTable = z.infer<typeof dashboardDetailTableSchema>;

export const dashboardDetailSchema = z.object({
  metric: dashboardMetricSchema,
  /** Janela usada (dias de São Paulo), para o modal dizer o período exato. */
  range: z.object({
    from: isoDateSchema,
    to: isoDateSchema,
    previousFrom: isoDateSchema,
    previousTo: isoDateSchema,
  }),
  tables: z.array(dashboardDetailTableSchema),
});
export type DashboardDetail = z.infer<typeof dashboardDetailSchema>;

/* Pendências (o que precisa de atenção agora) --------------------------- */

/**
 * Tipos de pendência. Cada um só aparece para quem tem a permissão da tela
 * que resolve (ex.: cupons para aprovar → coupons.approve). Lojista vê só
 * os da própria loja.
 */
export const pendingKindSchema = z.enum([
  /** Cupons de lojista aguardando a revisão da ARP. */
  "couponsToReview",
  /** Lojistas que se cadastraram pelo link e esperam aprovação. */
  "merchantSignups",
  /** Promoções no ar com menos de 10% do estoque. */
  "couponsLowStock",
  /** Promoções no ar que terminam nos próximos 3 dias. */
  "couponsEndingSoon",
  /** Campanha publicada do mês atual sem nenhum desafio. */
  "campaignWithoutChallenges",
  /** Nenhuma campanha começa no mês que vem. */
  "nextMonthWithoutCampaign",
  /** Notificações agendadas para sair hoje. */
  "notificationsToday",
  /** Prêmios ativos da lojinha com estoque zerado. */
  "prizesOutOfStock",
]);
export type PendingKind = z.infer<typeof pendingKindSchema>;

export const pendingItemSchema = z.object({
  kind: pendingKindSchema,
  count: z.number().int(),
  /** Até 3 exemplos (para o texto e o link direto quando é um só). */
  samples: z.array(z.object({ id: idSchema, name: z.string() })),
});
export type PendingItem = z.infer<typeof pendingItemSchema>;

export const pendingSchema = z.object({
  /** Só os tipos com algo a fazer, na ordem de prioridade. */
  data: z.array(pendingItemSchema),
});
export type Pending = z.infer<typeof pendingSchema>;

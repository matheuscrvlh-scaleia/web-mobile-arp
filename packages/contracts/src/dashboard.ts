import { z } from "zod";
import { idSchema, isoDateSchema, refSchema } from "./common";
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

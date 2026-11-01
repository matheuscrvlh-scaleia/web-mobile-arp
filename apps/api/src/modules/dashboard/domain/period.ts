import { addDaysToDate, toLocal } from "../../../shared/domain/time";

export type DashboardPeriod = "7d" | "30d" | "90d";

export const PERIOD_DAYS: Record<DashboardPeriod, number> = { "7d": 7, "30d": 30, "90d": 90 };

/**
 * Janela do painel em dias de calendário de São Paulo: o período atual
 * termina hoje (inclusive) e o anterior tem o mesmo tamanho, logo antes.
 */
export interface PeriodRange {
  days: number;
  /** Hoje em São Paulo (YYYY-MM-DD). */
  today: string;
  from: string;
  to: string;
  previousFrom: string;
  previousTo: string;
}

export function periodRange(period: DashboardPeriod, now: Date): PeriodRange {
  const days = PERIOD_DAYS[period];
  const today = toLocal(now).date;
  const from = addDaysToDate(today, -(days - 1));
  return {
    days,
    today,
    from,
    to: today,
    previousFrom: addDaysToDate(from, -days),
    previousTo: addDaysToDate(from, -1),
  };
}

/** Usados / pegos no período, entre 0 e 1 (4 casas). Sem pegos = 0. */
export function redemptionRate(redeemed: number, claimed: number): number {
  if (claimed <= 0) return 0;
  return Math.round(Math.min(1, redeemed / claimed) * 10_000) / 10_000;
}

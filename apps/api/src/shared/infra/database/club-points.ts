import { BUSINESS_TIME_ZONE } from "../../domain/time";
import { type SqlFragment, sql } from "./sql";

/*
 * Trevos do Clube ARP. Selos são conquistas permanentes (não vencem); cada
 * conquista dá Trevos. O programa é por ano do calendário (São Paulo): os
 * Trevos ganhos no ano valem para troca até 31/12 daquele ano. Saldo = Trevos
 * ganhos no ano − trocas do ano que não foram canceladas. Nunca fica negativo.
 */

/** Início do ano (instante) em que `now` cai, no fuso da ARP. */
export function yearStartSql(now: Date): SqlFragment {
  return sql`(date_trunc('year', ${now}::timestamptz at time zone ${BUSINESS_TIME_ZONE}) at time zone ${BUSINESS_TIME_ZONE})`;
}

/** Fim do ano (exclusivo): 1º de janeiro do ano seguinte, 00:00 em São Paulo. */
export function yearEndSql(now: Date): SqlFragment {
  return sql`(${yearStartSql(now)} + interval '1 year')`;
}

/** Último instante em que os Trevos de agora ainda valem (31/12 23:59:59.999). */
export function trevosValidUntil(now: Date): Date {
  const year = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: BUSINESS_TIME_ZONE, year: "numeric" }).format(now),
  );
  // São Paulo não tem horário de verão desde 2019: 31/12 23:59:59.999 = 02:59:59.999Z de 1º/1.
  return new Date(Date.UTC(year + 1, 0, 1, 3, 0, 0) - 1);
}

/** Trevos ganhos no ano de `now` pelo visitante `visitorId` (expressão SQL do id). */
export function earnedThisYearSql(visitorId: SqlFragment, now: Date): SqlFragment {
  return sql`coalesce((select sum(es.points) from gamification.earned_seals es
             where es.visitor_id = ${visitorId} and es.earned_at >= ${yearStartSql(now)}
               and es.earned_at <= ${now}), 0)`;
}

/** Saldo de Trevos do visitante `visitorId` (expressão SQL do id). */
export function visitorPointsSql(visitorId: SqlFragment, now: Date): SqlFragment {
  return sql`greatest(
    ${earnedThisYearSql(visitorId, now)}
    - coalesce((select sum(pr.points) from gamification.prize_redemptions pr
                where pr.visitor_id = ${visitorId} and pr.status <> 'cancelled'
                  and pr.created_at >= ${yearStartSql(now)}), 0),
    0)::int`;
}

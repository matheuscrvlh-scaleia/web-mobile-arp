import { type SqlFragment, sql } from "./sql";

/**
 * Pontos do Clube ARP (Fase 2): o programa é anual. Contam os selos que não
 * venceram e foram ganhos nos últimos 12 meses, menos as trocas (não
 * canceladas) do mesmo período. Nunca fica negativo.
 */
export const POINTS_VALIDITY_MONTHS = 12;

/** Meses configurados pela ARP (atalho: lê a linha da configuração direto; o PATCH já valida). */
const validityMonths = sql`coalesce((select (s.value)::int from platform.settings s where s.key = 'pointsValidityMonths'), ${POINTS_VALIDITY_MONTHS})`;

/** Total de pontos do visitante `visitorId` (expressão SQL do id). */
export function visitorPointsSql(visitorId: SqlFragment, now: Date): SqlFragment {
  return sql`greatest(
    coalesce((select sum(es.points) from gamification.earned_seals es
              where es.visitor_id = ${visitorId} and es.expires_at > ${now}
                and es.earned_at > ${now}::timestamptz - make_interval(months => ${validityMonths})), 0)
    - coalesce((select sum(pr.points) from gamification.prize_redemptions pr
                where pr.visitor_id = ${visitorId} and pr.status <> 'cancelled'
                  and pr.created_at > ${now}::timestamptz - make_interval(months => ${validityMonths})), 0),
    0)::int`;
}

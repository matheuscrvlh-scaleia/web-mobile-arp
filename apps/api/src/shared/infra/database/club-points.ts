import { DEFAULT_TREVOS_VALID_UNTIL } from "@arp/contracts";
import { BUSINESS_TIME_ZONE } from "../../domain/time";
import type { Database } from "./database";
import { type SqlFragment, sql } from "./sql";

/*
 * Trevos do Clube ARP. Selos são conquistas permanentes (não vencem); cada
 * conquista dá Trevos. A validade é escolhida pela ARP na gestão
 * (Configurações → Clube ARP): os Trevos ganhos desde "contam a partir de"
 * valem até "valem até" (inclusive, no fuso da ARP). Vencida a data, o saldo
 * zera até a ARP escolher outra. Saldo = Trevos ganhos no período − trocas do
 * período que não foram canceladas. Nunca fica negativo.
 */

const setting = (key: string) =>
  sql`(select s.value #>> '{}' from platform.settings s where s.key = ${key})`;

/** Último dia (date) em que os Trevos valem. */
const untilDateSql = sql`coalesce(${setting("trevosValidUntil")}, ${DEFAULT_TREVOS_VALID_UNTIL})::date`;

/** Fim (exclusivo) da validade: 00:00 do dia seguinte ao "valem até", em São Paulo. */
export const validEndSql: SqlFragment = sql`((${untilDateSql} + 1)::timestamp at time zone ${BUSINESS_TIME_ZONE})`;

/** Desde quando os Trevos contam (instante). */
const countFromSql = sql`coalesce((${setting("trevosCountFrom")}::date)::timestamp at time zone ${BUSINESS_TIME_ZONE}, '-infinity'::timestamptz)`;

/** Início do período que vale agora: depois da validade vencida, nada do período antigo conta. */
export function cycleStartSql(now: Date): SqlFragment {
  return sql`greatest(${countFromSql},
    case when ${now}::timestamptz >= ${validEndSql} then ${validEndSql} else '-infinity'::timestamptz end)`;
}

/** Até quando os Trevos de agora valem (último instante); null = validade vencida. */
export async function trevosValidUntil(db: Database, now: Date): Promise<Date | null> {
  const r = await db.one<{ until: Date | null }>(sql`
    select case when ${now}::timestamptz < ${validEndSql}
                then ${validEndSql} - interval '1 millisecond' end as until
  `);
  return r.until;
}

/** Trevos ganhos no período que vale agora pelo visitante `visitorId` (expressão SQL do id). */
export function earnedInCycleSql(visitorId: SqlFragment, now: Date): SqlFragment {
  return sql`coalesce((select sum(es.points) from gamification.earned_seals es
             where es.visitor_id = ${visitorId} and es.earned_at >= ${cycleStartSql(now)}
               and es.earned_at <= ${now}), 0)`;
}

/** Saldo de Trevos do visitante `visitorId` (expressão SQL do id). */
export function visitorPointsSql(visitorId: SqlFragment, now: Date): SqlFragment {
  return sql`greatest(
    ${earnedInCycleSql(visitorId, now)}
    - coalesce((select sum(pr.points) from gamification.prize_redemptions pr
                where pr.visitor_id = ${visitorId} and pr.status <> 'cancelled'
                  and pr.created_at >= ${cycleStartSql(now)}), 0),
    0)::int`;
}

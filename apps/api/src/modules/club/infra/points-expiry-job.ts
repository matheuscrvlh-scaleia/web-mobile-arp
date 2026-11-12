import type { Clock } from "../../../shared/application/ports/clock";
import type { PushMessage, PushSender } from "../../../shared/application/ports/push-sender";
import {
  visitorPointsSql,
  yearEndSql,
  yearStartSql,
} from "../../../shared/infra/database/club-points";
import type { Database, DatabaseLogger } from "../../../shared/infra/database/database";
import { sql } from "../../../shared/infra/database/sql";
import type { Job } from "../../../shared/infra/jobs/scheduler";
import type { PgClubStore } from "./pg-club-store";

const DEFAULT_NOTICE_DAYS = 15;
const PUSH_CHUNK = 100;

/**
 * Os Trevos vencem em 31/12. Faltando N dias para o fim do ano (configuração
 * pointsExpiryNoticeDays; 0 = sem aviso), avisa por push quem ainda tem saldo.
 * Cada conquista do ano avisa uma vez só: marca e lê na mesma instrução, então
 * duas réplicas não avisam em dobro.
 */
export function pointsExpiryJob(deps: {
  db: Database;
  push: PushSender;
  clock: Clock;
  logger: DatabaseLogger;
}): Job {
  return {
    name: "club-points-expiry-notice",
    intervalMs: 60 * 60_000,
    run: async () => {
      const { db, push, clock, logger } = deps;
      const now = clock.now();
      const rows = await db.many<{ points: number; tokens: string[] }>(sql`
        with cfg as (
          select coalesce((select (s.value)::int from platform.settings s
                           where s.key = 'pointsExpiryNoticeDays'), ${DEFAULT_NOTICE_DAYS}) as days
        ),
        due as (
          update gamification.earned_seals es set expiry_notified_at = ${now}
          where es.expiry_notified_at is null and (select days from cfg) > 0
            and es.earned_at >= ${yearStartSql(now)}
            and ${now}::timestamptz >= ${yearEndSql(now)} - make_interval(days => (select days from cfg))
          returning es.visitor_id
        ),
        who as (select distinct visitor_id from due)
        select ${visitorPointsSql(sql`w.visitor_id`, now)} as points,
               array(select t.token from visitors.push_tokens t where t.visitor_id = w.visitor_id)
                 as tokens
        from who w
      `);
      const messages: PushMessage[] = rows
        .filter((r) => r.points > 0)
        .flatMap((r) =>
          r.tokens.map((to) => ({
            to,
            title: "Seus Trevos vencem em 31/12",
            body: `Você tem ${r.points} ${r.points === 1 ? "Trevo" : "Trevos"}. Troque na lojinha do Clube ARP antes do fim do ano!`,
            data: { url: "/desafios" },
          })),
        );
      for (let i = 0; i < messages.length; i += PUSH_CHUNK) {
        await push.send(messages.slice(i, i + PUSH_CHUNK));
      }
      if (messages.length > 0) logger.info({ avisos: messages.length }, "Aviso de Trevos vencendo");
    },
  };
}

/** Trocas feitas no app que passaram do prazo sem retirada: Trevos e estoque voltam. */
export function pendingRedemptionsJob(deps: {
  store: PgClubStore;
  clock: Clock;
  logger: DatabaseLogger;
}): Job {
  return {
    name: "club-pending-redemptions-expiry",
    intervalMs: 10 * 60_000,
    run: async () => {
      const n = await deps.store.expirePending(deps.clock.now());
      if (n > 0) deps.logger.info({ trocas: n }, "Trocas não retiradas canceladas");
    },
  };
}

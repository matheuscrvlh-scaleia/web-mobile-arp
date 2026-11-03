import type { Clock } from "../../../shared/application/ports/clock";
import type { PushMessage, PushSender } from "../../../shared/application/ports/push-sender";
import type { Database, DatabaseLogger } from "../../../shared/infra/database/database";
import { sql } from "../../../shared/infra/database/sql";
import type { Job } from "../../../shared/infra/jobs/scheduler";

const DEFAULT_NOTICE_DAYS = 15;
const PUSH_CHUNK = 100;

/**
 * Avisa por push quem tem selo vencendo nos próximos N dias (configuração
 * pointsExpiryNoticeDays; 0 = sem aviso). Cada selo ganho avisa uma vez só:
 * marca e lê na mesma instrução, então duas réplicas não avisam em dobro.
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
      const rows = await db.many<{ points: number; expires_at: Date; tokens: string[] }>(sql`
        with cfg as (
          select coalesce((select (s.value)::int from platform.settings s
                           where s.key = 'pointsExpiryNoticeDays'), ${DEFAULT_NOTICE_DAYS}) as days
        ),
        due as (
          update gamification.earned_seals es set expiry_notified_at = ${now}
          where es.expiry_notified_at is null and (select days from cfg) > 0
            and es.expires_at > ${now}
            and es.expires_at <= ${now}::timestamptz + make_interval(days => (select days from cfg))
          returning es.visitor_id, es.points, es.expires_at
        )
        select sum(d.points)::int as points, min(d.expires_at) as expires_at,
               array(select t.token from visitors.push_tokens t where t.visitor_id = d.visitor_id)
                 as tokens
        from due d
        group by d.visitor_id
      `);
      const messages: PushMessage[] = rows.flatMap((r) => {
        const day = r.expires_at.toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          timeZone: "America/Sao_Paulo",
        });
        return r.tokens.map((to) => ({
          to,
          title: "Seus pontos do Clube ARP vão vencer",
          body: `${r.points} pontos vencem em ${day}. Troque na lojinha antes!`,
          data: { url: "/desafios" },
        }));
      });
      for (let i = 0; i < messages.length; i += PUSH_CHUNK) {
        await push.send(messages.slice(i, i + PUSH_CHUNK));
      }
      if (messages.length > 0) logger.info({ avisos: messages.length }, "Aviso de pontos vencendo");
    },
  };
}

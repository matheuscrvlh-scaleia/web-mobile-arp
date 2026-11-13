import type { Database, DatabaseLogger } from "../../../shared/infra/database/database";
import { sql } from "../../../shared/infra/database/sql";
import type { Job } from "../../../shared/infra/jobs/scheduler";

/** API de conversões da RD Station Marketing. */
const RD_CONVERSIONS_URL = "https://api.rd.services/platform/conversions";
const BATCH = 50;
const TIMEOUT_MS = 15_000;

export interface RdStationConfig {
  apiKey: string;
  /** Identificador da conversão: é ele que põe o contato no funil e na etapa certos. */
  conversion: string;
}

/**
 * Leva para o RD quem marcou "Quero receber novidades e ofertas" (nome, e-mail
 * e o aceite). Desligado até a ARP definir o funil e a etapa: só entra na
 * lista de jobs com RD_STATION_ENABLED=true, a chave e a conversão
 * (container.ts). Até lá, o contato fica pronto: marketing_opt_in = true e
 * rd_sent_at vazio. Quem não marcou nunca vai.
 */
export function rdStationLeadsJob(deps: {
  db: Database;
  config: RdStationConfig;
  logger: DatabaseLogger;
}): Job {
  return {
    name: "rd-station-leads",
    intervalMs: 10 * 60_000,
    run: async () => {
      const { db, config, logger } = deps;
      const leads = await db.many<{ id: string; name: string; email: string }>(sql`
        select id, name, email from visitors.visitors
        where marketing_opt_in and status = 'active' and rd_sent_at is null
        order by created_at
        limit ${BATCH}
      `);
      let sent = 0;
      for (const lead of leads) {
        const res = await fetch(
          `${RD_CONVERSIONS_URL}?api_key=${encodeURIComponent(config.apiKey)}`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            signal: AbortSignal.timeout(TIMEOUT_MS),
            body: JSON.stringify({
              event_type: "CONVERSION",
              event_family: "CDP",
              payload: {
                conversion_identifier: config.conversion,
                name: lead.name,
                email: lead.email,
                legal_bases: [{ category: "communications", type: "consent", status: "granted" }],
              },
            }),
          },
        ).catch(() => null);
        if (!res?.ok) {
          logger.warn(
            { status: res?.status ?? null },
            "RD Station recusou o contato; tenta de novo depois",
          );
          break;
        }
        await db.query(sql`update visitors.visitors set rd_sent_at = now() where id = ${lead.id}`);
        sent += 1;
      }
      if (sent > 0) logger.info({ contatos: sent }, "Contatos enviados ao RD Station");
    },
  };
}

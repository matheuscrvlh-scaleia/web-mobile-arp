import type { AuditEntry, AuditLogger } from "../../application/ports/audit-logger";
import type { Database } from "../database/database";
import { sql } from "../database/sql";

/** Grava em audit.audit_logs usando a transação corrente (se houver). */
export class PgAuditLogger implements AuditLogger {
  constructor(private readonly db: Database) {}

  async log({ actor, action, entityType, entityId, changes }: AuditEntry): Promise<void> {
    const { origin } = actor;
    await this.db.query(sql`
      insert into audit.audit_logs
        (actor_type, actor_id, actor_name, action, entity_type, entity_id, changes, ip, user_agent, request_id)
      values
        (${actor.type}, ${actor.id}, ${actor.name}, ${action}, ${entityType}, ${entityId},
         ${changes ? JSON.stringify(changes) : null}::jsonb, ${origin.ip}::inet,
         ${origin.userAgent?.slice(0, 400) ?? null}, ${origin.requestId})
    `);
  }
}

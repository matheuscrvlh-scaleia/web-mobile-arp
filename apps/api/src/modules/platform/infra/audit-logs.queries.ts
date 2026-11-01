import type { AuditLog, ListAuditLogsQuery } from "@arp/contracts";
import {
  decodeCursor,
  type KeysetPage,
  offsetOf,
  toKeysetPage,
} from "../../../shared/application/pagination";
import { ValidationError } from "../../../shared/domain/errors";
import { BUSINESS_TIME_ZONE } from "../../../shared/domain/time";
import type { Database } from "../../../shared/infra/database/database";
import { sql } from "../../../shared/infra/database/sql";
import { iso } from "../../../shared/infra/presenters";

interface AuditRow {
  id: string;
  actor_type: "staff" | "visitor" | "system";
  actor_id: string | null;
  actor_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  changes: unknown;
  ip: string | null;
  created_at: Date;
  position_at: string;
}

function toAuditLog(r: AuditRow): AuditLog {
  const changes =
    r.changes !== null && typeof r.changes === "object" && !Array.isArray(r.changes)
      ? (r.changes as Record<string, unknown>)
      : null;
  return {
    id: r.id,
    actor: { type: r.actor_type, id: r.actor_id, name: r.actor_name },
    action: r.action,
    entityType: r.entity_type,
    entityId: r.entity_id,
    changes,
    ip: r.ip,
    createdAt: iso(r.created_at),
  };
}

/**
 * Histórico de alterações (somente leitura). Datas from/to são dias em São Paulo.
 *
 * A tabela só cresce: a página sai pelo índice (created_at desc, id desc) e
 * a contagem é à parte (index-only). Com `cursor` não há contagem nem offset.
 */
export class AuditLogQueries {
  constructor(private readonly db: Database) {}

  async list(query: ListAuditLogsQuery): Promise<KeysetPage<AuditLog>> {
    const tz = BUSINESS_TIME_ZONE;
    const position = query.cursor ? decodeCursor(query.cursor, 2) : null;
    if (query.cursor && (!position || !/^\d+$/.test(position[1] ?? ""))) {
      throw ValidationError.field("cursor", "Cursor inválido");
    }
    const filters = [
      query.actorId && sql`a.actor_id = ${query.actorId}`,
      query.entityType && sql`a.entity_type = ${query.entityType}`,
      query.entityId && sql`a.entity_id = ${query.entityId}`,
      query.action && sql`a.action = ${query.action}`,
      query.from && sql`a.created_at >= (${query.from}::date)::timestamp at time zone ${tz}`,
      query.to && sql`a.created_at < ((${query.to}::date) + 1)::timestamp at time zone ${tz}`,
      query.q &&
        sql`(public.f_unaccent(lower(coalesce(a.actor_name, ''))) like ${sql.containsPattern(query.q)}
             or a.action like ${sql.containsPattern(query.q)}
             or a.entity_type like ${sql.containsPattern(query.q)})`,
    ];
    const keyset =
      position && sql`(a.created_at, a.id) < (${position[0]}::timestamptz, ${position[1]}::bigint)`;

    const rows = await this.db.many<AuditRow>(sql`
      select a.id::text as id, a.actor_type, a.actor_id, a.actor_name, a.action, a.entity_type,
             a.entity_id, a.changes, host(a.ip) as ip, a.created_at,
             a.created_at::text as position_at
      from audit.audit_logs a
      ${sql.where([...filters, keyset])}
      order by a.created_at desc, a.id desc
      limit ${query.pageSize + 1} ${position ? sql.empty : sql`offset ${offsetOf(query)}`}
    `);
    const total = position
      ? null
      : (
          await this.db.one<{ n: number }>(
            sql`select count(*) as n from audit.audit_logs a ${sql.where(filters)}`,
          )
        ).n;
    return toKeysetPage(rows, query, total, (r) => [r.position_at, r.id], toAuditLog);
  }
}

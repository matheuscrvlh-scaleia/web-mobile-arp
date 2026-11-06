import type { AuditActorList, AuditLog, ListAuditLogsQuery } from "@arp/contracts";
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
import { auditSearchTokens } from "./audit-search";

interface AuditRow {
  id: string;
  actor_type: "staff" | "visitor" | "system";
  actor_id: string | null;
  actor_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_name: string | null;
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
    entityName: r.entity_name,
    changes,
    ip: r.ip,
    createdAt: iso(r.created_at),
  };
}

/** Tabela e coluna do nome de cada tipo de item do histórico. */
const ENTITY_NAMES: Record<string, [table: string, column: string]> = {
  store: ["directory.stores", "name"],
  store_category: ["directory.store_categories", "name"],
  block: ["directory.blocks", "name"],
  floor: ["directory.floors", "label"],
  map_point: ["directory.map_points", "label"],
  coupon: ["promotions.coupons", "title"],
  claim: ["promotions.coupon_claims", "code"],
  campaign: ["gamification.campaigns", "name"],
  challenge: ["gamification.challenges", "title"],
  seal: ["gamification.seals", "name"],
  qr_code: ["gamification.qr_codes", "label"],
  prize: ["gamification.prizes", "name"],
  prize_redemption: ["gamification.prize_redemptions", "code"],
  event: ["agenda.events", "title"],
  event_category: ["agenda.event_categories", "name"],
  highlight: ["marketing.highlights", "title"],
  notification: ["marketing.push_notifications", "title"],
  art_point: ["content.art_points", "name"],
  recycling_item: ["content.recycling_items", "name"],
  job: ["content.jobs", "title"],
  visitor: ["visitors.visitors", "name"],
  user: ["identity.users", "name"],
  role: ["identity.roles", "name"],
  merchant_signup: ["identity.merchant_signups", "name"],
};

/**
 * Nome do item: o atual (busca pela chave) ou, se já foi excluído, o que o
 * registro guardou (name/title/label do retrato ou do "para" da edição).
 * Só nomes de tabela fixos do código entram em sql.raw.
 */
const ENTITY_NAME = sql`coalesce(
  case a.entity_type
    ${sql.raw(
      Object.entries(ENTITY_NAMES)
        .map(
          ([type, [table, column]]) =>
            `when '${type}' then (select x.${column}::text from ${table} x where x.id = e.uid)`,
        )
        .join(" "),
    )}
  end,
  a.changes->>'name', a.changes->>'title', a.changes->>'label',
  a.changes->'name'->>'to', a.changes->'title'->>'to'
)`;

// Chave como uuid só quando é uuid (configurações usam a chave em texto).
const FROM = sql`from audit.audit_logs a
  cross join lateral (
    select case when a.entity_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                then a.entity_id::uuid end as uid
  ) e`;

/**
 * Busca em português: cada palavra precisa aparecer em algum lugar (quem fez,
 * nome do item) ou descrever a ação ("campanha" → campaign, "excluiu" → delete).
 * atalho: o nome do item sai de subconsulta por linha (sem índice); ok para o volume do histórico.
 */
function searchCondition(q: string) {
  return sql.and(
    auditSearchTokens(q).map((t) =>
      sql.or([
        sql`public.f_unaccent(lower(coalesce(a.actor_name, ''))) like ${sql.containsPattern(t.text)}`,
        sql`public.f_unaccent(lower(coalesce(${ENTITY_NAME}, ''))) like ${sql.containsPattern(t.text)}`,
        sql`a.action like ${sql.containsPattern(t.text)}`,
        t.entityTypes.length > 0 && sql`a.entity_type = any(${t.entityTypes})`,
        t.verbs.length > 0 && sql`split_part(a.action, '.', 2) = any(${t.verbs})`,
      ]),
    ),
  );
}

/** Ações que viram barulho no histórico: entrar e mandar foto. */
const ACCESS_ACTIONS = ["auth.login", "auth.logout", "visitor.login", "upload.create"];

/** Ações por tipo (o verbo vem depois do ponto: coupon.create, role.delete…). */
const VERB_SUFFIXES: Record<NonNullable<ListAuditLogsQuery["verb"]>, string[]> = {
  create: ["create", "register"],
  update: ["update", "locate", "replace_tiers", "reorder", "update_profile"],
  delete: ["delete", "remove", "anonymize"],
  status: [
    "change_status",
    "deactivate",
    "activate",
    "block",
    "unblock",
    "cancel",
    "schedule",
    "send",
    "approve",
    "reject",
    "deliver",
    "archive",
    "unarchive",
    "pause",
    "resume",
    "publish",
  ],
};

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
      query.verb && sql`split_part(a.action, '.', 2) = any(${VERB_SUFFIXES[query.verb]})`,
      query.hideAccess === "true" && sql`a.action <> all(${ACCESS_ACTIONS})`,
      query.from && sql`a.created_at >= (${query.from}::date)::timestamp at time zone ${tz}`,
      query.to && sql`a.created_at < ((${query.to}::date) + 1)::timestamp at time zone ${tz}`,
      query.q && searchCondition(query.q),
    ];
    const keyset =
      position && sql`(a.created_at, a.id) < (${position[0]}::timestamptz, ${position[1]}::bigint)`;

    const rows = await this.db.many<AuditRow>(sql`
      select a.id::text as id, a.actor_type, a.actor_id, a.actor_name, a.action, a.entity_type,
             a.entity_id, ${ENTITY_NAME} as entity_name, a.changes, host(a.ip) as ip,
             a.created_at, a.created_at::text as position_at
      ${FROM}
      ${sql.where([...filters, keyset])}
      order by a.created_at desc, a.id desc
      limit ${query.pageSize + 1} ${position ? sql.empty : sql`offset ${offsetOf(query)}`}
    `);
    const total = position
      ? null
      : (await this.db.one<{ n: number }>(sql`select count(*) as n ${FROM} ${sql.where(filters)}`))
          .n;
    return toKeysetPage(rows, query, total, (r) => [r.position_at, r.id], toAuditLog);
  }

  /** Pessoas da equipe que já fizeram algo (nome atual, ou o do registro). */
  async actors(): Promise<AuditActorList> {
    // Nomes repetidos ganham o e-mail para dar para escolher a pessoa certa.
    const data = await this.db.many<{ id: string; name: string }>(sql`
      select id, case when count(*) over (partition by name) > 1 and email is not null
                      then name || ' · ' || email else name end as name
      from (
        select a.actor_id::text as id, coalesce(u.name, max(a.actor_name), 'Sem nome') as name,
               u.email::text as email
        from audit.audit_logs a
        left join identity.users u on u.id = a.actor_id
        where a.actor_type = 'staff' and a.actor_id is not null
        group by a.actor_id, u.name, u.email
      ) x
      order by 2
    `);
    return { data };
  }
}

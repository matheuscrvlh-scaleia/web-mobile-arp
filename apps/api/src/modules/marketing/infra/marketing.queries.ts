import type {
  Highlight,
  HighlightBadge,
  HighlightStatus,
  HighlightTarget,
  HighlightTargetIssue,
  ListHighlightsQuery,
  ListNotificationsQuery,
  NotificationAudience,
  NotificationStatus,
  PushNotification,
} from "@arp/contracts";
import { offsetOf, type Page, toPage } from "../../../shared/application/pagination";
import { ValidationError } from "../../../shared/domain/errors";
import { phaseOf } from "../../../shared/domain/time";
import type { Database } from "../../../shared/infra/database/database";
import { type SqlFragment, sql } from "../../../shared/infra/database/sql";
import { iso, isoOrNull } from "../../../shared/infra/presenters";
import type { AudienceDirectory } from "../domain/repositories";

/* Destaques -------------------------------------------------------------- */

interface HighlightRow {
  id: string;
  title: string;
  subtitle: string | null;
  cta_label: string | null;
  image_url: string | null;
  badge: HighlightBadge;
  target_type: HighlightTarget;
  target_id: string | null;
  target_label: string | null;
  target_issue: HighlightTargetIssue | null;
  target_url: string | null;
  sponsor_store_id: string | null;
  sponsor_store_name: string | null;
  starts_at: Date;
  ends_at: Date;
  sort_order: number;
  status: HighlightStatus;
  impressions: number;
  clicks: number;
  created_at: Date;
  updated_at: Date;
}

/** Destaque com o nome do destino, o patrocinador e os totais de exibição/clique. */
const HIGHLIGHT_SELECT = sql`
  select h.id, h.title, h.subtitle, h.cta_label, h.image_url, h.badge, h.target_type,
         h.target_id, h.target_url, h.sponsor_store_id, sp.name as sponsor_store_name,
         h.starts_at, h.ends_at, h.sort_order, h.status,
         coalesce(m.impressions, 0) as impressions, coalesce(m.clicks, 0) as clicks,
         h.created_at, h.updated_at,
         case h.target_type
           when 'event' then ev.title
           when 'coupon' then cp.title
           when 'store' then st.name
         end as target_label,
         -- Destino que não abre direito no app (aviso no painel).
         case h.target_type
           when 'event' then case
             when ev.id is null then 'missing'
             when ev.archived_at is not null then 'archived'
             when ev.status in ('cancelled', 'paused', 'draft') then ev.status
             when not (ev.recurrence = 'weekly' and ev.ends_on is null)
               and coalesce(ev.ends_on, ev.starts_on) < (now() at time zone 'America/Sao_Paulo')::date
               then 'ended'
           end
           when 'coupon' then case
             when cp.id is null then 'missing'
             when cp.status in ('draft', 'paused', 'ended', 'archived') then cp.status
             when cp.ends_at <= now() then 'ended'
           end
           when 'store' then case
             when st.id is null then 'missing'
             when st.status <> 'active' then 'inactive'
           end
         end as target_issue
  from marketing.highlights h
  left join directory.stores sp on sp.id = h.sponsor_store_id
  left join agenda.events ev on h.target_type = 'event' and ev.id = h.target_id
  left join promotions.coupons cp on h.target_type = 'coupon' and cp.id = h.target_id
  left join directory.stores st on h.target_type = 'store' and st.id = h.target_id
  -- Totais = soma dos dias (gravados em lote pela API, ver highlight_daily_metrics).
  left join lateral (
    select sum(d.impressions) as impressions, sum(d.clicks) as clicks
    from marketing.highlight_daily_metrics d
    where d.highlight_id = h.id
  ) m on true
`;

function toHighlight(r: HighlightRow, now: Date): Highlight {
  return {
    id: r.id,
    title: r.title,
    subtitle: r.subtitle,
    ctaLabel: r.cta_label,
    imageUrl: r.image_url,
    badge: r.badge,
    targetType: r.target_type,
    targetId: r.target_id,
    targetLabel: r.target_label,
    targetIssue: r.target_issue,
    targetUrl: r.target_url,
    sponsorStore: r.sponsor_store_id
      ? { id: r.sponsor_store_id, name: r.sponsor_store_name ?? "" }
      : null,
    startsAt: iso(r.starts_at),
    endsAt: iso(r.ends_at),
    sortOrder: r.sort_order,
    status: r.status,
    phase: phaseOf(now, r.starts_at, r.ends_at),
    impressions: r.impressions,
    clicks: r.clicks,
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  };
}

function phaseFilter(phase: ListHighlightsQuery["phase"], now: Date): SqlFragment | undefined {
  if (phase === "upcoming") return sql`h.starts_at > ${now}`;
  if (phase === "live") return sql`h.starts_at <= ${now} and h.ends_at > ${now}`;
  if (phase === "ended") return sql`h.ends_at <= ${now}`;
  return undefined;
}

/* Notificações ----------------------------------------------------------- */

interface NotificationRow {
  id: string;
  title: string;
  body: string;
  audience: NotificationAudience;
  store_id: string | null;
  store_name: string | null;
  event_id: string | null;
  event_title: string | null;
  deep_link: string | null;
  scheduled_at: Date | null;
  sent_at: Date | null;
  status: NotificationStatus;
  recipients_count: number | null;
  is_demo: boolean;
  created_by: string;
  created_by_name: string;
  created_at: Date;
  updated_at: Date;
}

const NOTIFICATION_COLUMNS = sql`
  n.id, n.title, n.body, n.audience, n.store_id, s.name as store_name, n.event_id,
  ev.title as event_title, n.deep_link,
  n.scheduled_at, n.sent_at, n.status, n.recipients_count, n.created_by,
  u.name as created_by_name, n.created_at, n.updated_at, n.is_demo
`;

const NOTIFICATION_FROM = sql`
  from marketing.push_notifications n
  join identity.users u on u.id = n.created_by
  left join directory.stores s on s.id = n.store_id
  left join agenda.events ev on ev.id = n.event_id
`;

function toNotification(r: NotificationRow): PushNotification {
  return {
    id: r.id,
    title: r.title,
    body: r.body,
    audience: r.audience,
    store: r.store_id ? { id: r.store_id, name: r.store_name ?? "" } : null,
    event: r.event_id ? { id: r.event_id, name: r.event_title ?? "Evento excluído" } : null,
    deepLink: r.deep_link,
    scheduledAt: isoOrNull(r.scheduled_at),
    sentAt: isoOrNull(r.sent_at),
    status: r.status,
    recipientsCount: r.recipients_count,
    createdBy: { id: r.created_by, name: r.created_by_name },
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
    isDemo: r.is_demo,
  };
}

/** Leituras de destaques e notificações, já no formato do contrato. */
export class MarketingQueries {
  constructor(
    private readonly db: Database,
    private readonly audience: AudienceDirectory,
  ) {}

  /** Lista completa na ordem do carrossel (poucos destaques: sem paginação). */
  async listHighlights(query: ListHighlightsQuery, now: Date): Promise<Highlight[]> {
    const rows = await this.db.many<HighlightRow>(sql`
      ${HIGHLIGHT_SELECT}
      ${sql.where([query.status && sql`h.status = ${query.status}`, phaseFilter(query.phase, now)])}
      order by h.sort_order, h.id
    `);
    return rows.map((r) => toHighlight(r, now));
  }

  async getHighlight(id: string, now: Date): Promise<Highlight | null> {
    const row = await this.db.maybeOne<HighlightRow>(sql`${HIGHLIGHT_SELECT} where h.id = ${id}`);
    return row ? toHighlight(row, now) : null;
  }

  async listNotifications(query: ListNotificationsQuery): Promise<Page<PushNotification>> {
    const rows = await this.db.many<NotificationRow & { total: number }>(sql`
      select ${NOTIFICATION_COLUMNS}, count(*) over() as total
      ${NOTIFICATION_FROM}
      ${sql.where([
        query.status && sql`n.status = ${query.status}`,
        query.q &&
          sql`(public.f_unaccent(lower(n.title)) like ${sql.containsPattern(query.q)}
                 or public.f_unaccent(lower(n.body)) like ${sql.containsPattern(query.q)})`,
      ])}
      order by coalesce(n.sent_at, n.scheduled_at, n.created_at) desc, n.id desc
      limit ${query.pageSize} offset ${offsetOf(query)}
    `);
    return toPage(rows, query, toNotification);
  }

  async getNotification(id: string): Promise<PushNotification | null> {
    const row = await this.db.maybeOne<NotificationRow>(
      sql`select ${NOTIFICATION_COLUMNS} ${NOTIFICATION_FROM} where n.id = ${id}`,
    );
    return row ? toNotification(row) : null;
  }

  async estimate(
    audience: NotificationAudience,
    storeId?: string,
    eventId?: string,
  ): Promise<number> {
    if (audience === "store_followers" && !storeId) {
      throw ValidationError.field("storeId", "Escolha a loja");
    }
    if (audience === "event_interested" && !eventId) {
      throw ValidationError.field("eventId", "Escolha o evento");
    }
    return this.audience.count({ audience, storeId: storeId ?? null, eventId: eventId ?? null });
  }
}

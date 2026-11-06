import type { Database } from "../../../shared/infra/database/database";
import { type SqlFragment, sql } from "../../../shared/infra/database/sql";
import {
  type EntityTarget,
  Highlight,
  type HighlightBadge,
  type HighlightStatus,
  type HighlightTarget,
  type NewHighlight,
} from "../domain/highlight";
import {
  type NotificationAudience,
  type NotificationStatus,
  PushNotification,
} from "../domain/push-notification";
import type {
  AudienceDirectory,
  AudienceTarget,
  HighlightRepository,
  MarketingReferences,
  NewPushNotification,
  PushNotificationRepository,
  PushRecipient,
} from "../domain/repositories";

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
  target_url: string | null;
  sponsor_store_id: string | null;
  starts_at: Date;
  ends_at: Date;
  sort_order: number;
  status: HighlightStatus;
}

const HIGHLIGHT_COLUMNS = sql.raw(`id, title, subtitle, cta_label, image_url, badge, target_type,
  target_id, target_url, sponsor_store_id, starts_at, ends_at, sort_order, status`);

const highlightToDomain = (r: HighlightRow) =>
  Highlight.restore({
    id: r.id,
    title: r.title,
    subtitle: r.subtitle,
    ctaLabel: r.cta_label,
    imageUrl: r.image_url,
    badge: r.badge,
    targetType: r.target_type,
    targetId: r.target_id,
    targetUrl: r.target_url,
    sponsorStoreId: r.sponsor_store_id,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    sortOrder: r.sort_order,
    status: r.status,
  });

export class PgHighlightRepository implements HighlightRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<Highlight | null> {
    const row = await this.db.maybeOne<HighlightRow>(
      sql`select ${HIGHLIGHT_COLUMNS} from marketing.highlights where id = ${id}`,
    );
    return row ? highlightToDomain(row) : null;
  }

  async create(d: NewHighlight): Promise<Highlight> {
    const row = await this.db.one<HighlightRow>(sql`
      insert into marketing.highlights
        (title, subtitle, cta_label, image_url, badge, target_type, target_id, target_url,
         sponsor_store_id, starts_at, ends_at, status, sort_order)
      values
        (${d.title}, ${d.subtitle}, ${d.ctaLabel}, ${d.imageUrl}, ${d.badge}, ${d.targetType},
         ${d.targetId}, ${d.targetUrl}, ${d.sponsorStoreId}, ${d.startsAt}, ${d.endsAt}, ${d.status},
         (select coalesce(max(sort_order), 0) + 1 from marketing.highlights))
      returning ${HIGHLIGHT_COLUMNS}
    `);
    return highlightToDomain(row);
  }

  async save(highlight: Highlight): Promise<void> {
    const s = highlight.toState();
    await this.db.query(sql`
      update marketing.highlights
      set title = ${s.title}, subtitle = ${s.subtitle}, cta_label = ${s.ctaLabel},
          image_url = ${s.imageUrl}, badge = ${s.badge}, target_type = ${s.targetType},
          target_id = ${s.targetId}, target_url = ${s.targetUrl},
          sponsor_store_id = ${s.sponsorStoreId}, starts_at = ${s.startsAt}, ends_at = ${s.endsAt},
          status = ${s.status}
      where id = ${s.id}
    `);
  }

  async delete(id: string): Promise<void> {
    await this.db.query(sql`delete from marketing.highlights where id = ${id}`);
  }

  async lockAllIds(): Promise<string[]> {
    const rows = await this.db.many<{ id: string }>(
      sql`select id from marketing.highlights where status <> 'archived' order by sort_order, id for update`,
    );
    return rows.map((r) => r.id);
  }

  async moveToEnd(id: string): Promise<void> {
    await this.db.query(sql`
      update marketing.highlights
      set sort_order = (select coalesce(max(sort_order), 0) + 1 from marketing.highlights)
      where id = ${id}
    `);
  }

  async impressions(id: string): Promise<number> {
    const { n } = await this.db.one<{ n: number }>(sql`
      select coalesce(sum(impressions), 0)::int8 as n
      from marketing.highlight_daily_metrics where highlight_id = ${id}
    `);
    return n;
  }

  async applyOrder(ids: readonly string[]): Promise<void> {
    await this.db.query(sql`
      update marketing.highlights h
      set sort_order = o.position
      from unnest(${[...ids]}::uuid[]) with ordinality as o(id, position)
      where h.id = o.id and h.sort_order is distinct from o.position
    `);
  }
}

/* Referências ------------------------------------------------------------ */

const TARGET_TABLE: Record<EntityTarget, SqlFragment> = {
  event: sql.raw("agenda.events"),
  coupon: sql.raw("promotions.coupons"),
  store: sql.raw("directory.stores"),
};

export class PgMarketingReferences implements MarketingReferences {
  constructor(private readonly db: Database) {}

  targetExists(type: EntityTarget, id: string): Promise<boolean> {
    return this.db.exists(sql`select 1 from ${TARGET_TABLE[type]} where id = ${id}`);
  }

  storeExists(id: string): Promise<boolean> {
    return this.targetExists("store", id);
  }

  storeLinkExists(idOrSlug: string): Promise<boolean> {
    return this.db.exists(
      sql`select 1 from directory.stores where id::text = ${idOrSlug} or slug = ${idOrSlug}`,
    );
  }
}

/* Notificações ----------------------------------------------------------- */

interface NotificationRow {
  id: string;
  title: string;
  body: string;
  audience: NotificationAudience;
  store_id: string | null;
  event_id: string | null;
  deep_link: string | null;
  scheduled_at: Date | null;
  sent_at: Date | null;
  status: NotificationStatus;
  recipients_count: number | null;
  created_by: string;
}

const NOTIFICATION_COLUMNS = sql.raw(`id, title, body, audience, store_id, event_id, deep_link,
  scheduled_at, sent_at, status, recipients_count, created_by`);

const notificationToDomain = (r: NotificationRow) =>
  PushNotification.restore({
    id: r.id,
    title: r.title,
    body: r.body,
    audience: r.audience,
    storeId: r.store_id,
    eventId: r.event_id,
    deepLink: r.deep_link,
    scheduledAt: r.scheduled_at,
    sentAt: r.sent_at,
    status: r.status,
    recipientsCount: r.recipients_count,
    createdBy: r.created_by,
  });

export class PgPushNotificationRepository implements PushNotificationRepository {
  constructor(private readonly db: Database) {}

  async findByIdForUpdate(id: string): Promise<PushNotification | null> {
    const row = await this.db.maybeOne<NotificationRow>(sql`
      select ${NOTIFICATION_COLUMNS} from marketing.push_notifications where id = ${id} for update
    `);
    return row ? notificationToDomain(row) : null;
  }

  async create(d: NewPushNotification): Promise<PushNotification> {
    const row = await this.db.one<NotificationRow>(sql`
      insert into marketing.push_notifications
        (title, body, audience, store_id, event_id, deep_link, created_by)
      values (${d.title}, ${d.body}, ${d.audience}, ${d.storeId}, ${d.eventId}, ${d.deepLink},
        ${d.createdBy})
      returning ${NOTIFICATION_COLUMNS}
    `);
    return notificationToDomain(row);
  }

  async save(notification: PushNotification): Promise<void> {
    const s = notification.toState();
    await this.db.query(sql`
      update marketing.push_notifications
      set title = ${s.title}, body = ${s.body}, audience = ${s.audience}, store_id = ${s.storeId},
          event_id = ${s.eventId},
          deep_link = ${s.deepLink}, scheduled_at = ${s.scheduledAt}, sent_at = ${s.sentAt},
          status = ${s.status}, recipients_count = ${s.recipientsCount}
      where id = ${s.id}
    `);
  }

  async delete(id: string): Promise<void> {
    await this.db.query(sql`delete from marketing.push_notifications where id = ${id}`);
  }

  async lockDue(now: Date, limit: number): Promise<PushNotification[]> {
    const rows = await this.db.many<NotificationRow>(sql`
      select ${NOTIFICATION_COLUMNS}
      from marketing.push_notifications
      where status = 'scheduled' and scheduled_at <= ${now}
      order by scheduled_at
      limit ${limit}
      for update skip locked
    `);
    return rows.map(notificationToDomain);
  }
}

/* Público ---------------------------------------------------------------- */

/** Condição do público sobre visitors.visitors v (só visitantes ativos e reais: fictício não recebe). */
function audienceCondition({ audience, storeId, eventId }: AudienceTarget): SqlFragment {
  switch (audience) {
    case "all":
      return sql`v.status = 'active' and not v.is_demo`;
    case "opted_in":
      return sql`v.status = 'active' and not v.is_demo and v.marketing_opt_in`;
    case "store_followers":
      if (!storeId) return sql`false`;
      return sql`v.status = 'active' and not v.is_demo and exists (
        select 1 from visitors.store_follows f where f.visitor_id = v.id and f.store_id = ${storeId}
      )`;
    case "event_interested":
      // Aviso de serviço (adiado, cancelado): não depende do aceite de ofertas.
      if (!eventId) return sql`false`;
      return sql`v.status = 'active' and not v.is_demo and exists (
        select 1 from agenda.event_interests i where i.visitor_id = v.id and i.event_id = ${eventId}
      )`;
  }
}

export class PgAudienceDirectory implements AudienceDirectory {
  constructor(private readonly db: Database) {}

  async count(target: AudienceTarget): Promise<number> {
    const { n } = await this.db.one<{ n: number }>(sql`
      select count(*) as n
      from visitors.visitors v
      where ${audienceCondition(target)}
        and exists (select 1 from visitors.push_tokens t where t.visitor_id = v.id)
    `);
    return n;
  }

  async recipients(target: AudienceTarget): Promise<PushRecipient[]> {
    const rows = await this.db.many<{ visitor_id: string; token: string }>(sql`
      select t.visitor_id, t.token
      from visitors.visitors v
      join visitors.push_tokens t on t.visitor_id = v.id
      where ${audienceCondition(target)}
      order by t.visitor_id
    `);
    return rows.map((r) => ({ visitorId: r.visitor_id, token: r.token }));
  }
}

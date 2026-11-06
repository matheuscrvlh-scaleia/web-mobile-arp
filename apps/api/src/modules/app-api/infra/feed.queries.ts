import type { App } from "@arp/contracts";
import { offsetOf, type Page, toPage } from "../../../shared/application/pagination";
import { addDaysToDate, toLocal } from "../../../shared/domain/time";
import type { Database } from "../../../shared/infra/database/database";
import { type SqlFragment, sql } from "../../../shared/infra/database/sql";
import { storeHasKind } from "../../../shared/infra/database/store-categories";
import { hhmmOrNull } from "../../../shared/infra/presenters";
import { datesBetween, nextOccurrence, occursOn } from "../domain/event-occurrence";
import {
  type ClaimRow,
  type CouponCardRow,
  claimSelect,
  couponCardSelect,
  liveCoupon,
  toClaim,
  toCouponCard,
} from "./fragments";

type Tone = App.EventCard["tone"];

interface EventRow {
  id: string;
  title: string;
  image_url: string | null;
  tone: Tone;
  icon: string | null;
  place: string;
  recurrence: "single" | "range" | "weekly";
  starts_on: string;
  ends_on: string | null;
  weekday: number | null;
  weekdays: number[] | null;
  start_time: string | null;
  end_time: string | null;
  is_long_running: boolean;
  awards_seal: boolean;
  category_id: string;
  category_name: string;
  category_icon: string;
}

interface EventDetailRow extends EventRow {
  description: string;
  floor_id: string | null;
  floor_label: string | null;
  store_id: string | null;
  store_slug: string | null;
  store_name: string | null;
  interests_count: number;
  is_interested: boolean;
}

const eventSelect = (extra: SqlFragment = sql.empty) => sql`
  select e.id, e.title, e.image_url, e.tone, e.icon, e.place, e.recurrence, e.starts_on,
         e.ends_on, e.weekday, e.weekdays, e.start_time, e.end_time, e.is_long_running, e.awards_seal,
         ec.id as category_id, ec.name as category_name, ec.icon as category_icon
         ${extra}
  from agenda.events e
  join agenda.event_categories ec on ec.id = e.category_id
`;

/** Eventos publicados que acontecem em algum dia de [from, to] (índice GiST de active_period). */
const publishedBetween = (from: string, to: string) =>
  sql`e.status = 'published' and e.active_period && daterange(${from}::date, ${to}::date, '[]')`;

function toEventCard(r: EventRow, today: string): App.EventCard {
  const recurrence = {
    recurrence: r.recurrence,
    startsOn: r.starts_on,
    endsOn: r.ends_on,
    weekdays: r.weekdays,
  };
  return {
    id: r.id,
    title: r.title,
    category: { id: r.category_id, name: r.category_name, icon: r.category_icon },
    imageUrl: r.image_url,
    tone: r.tone,
    icon: r.icon,
    place: r.place,
    ...recurrence,
    weekday: r.weekday,
    startTime: hhmmOrNull(r.start_time),
    endTime: hhmmOrNull(r.end_time),
    isLongRunning: r.is_long_running,
    awardsSeal: r.awards_seal,
    nextDate: nextOccurrence(recurrence, today),
  };
}

/** No mesmo dia: faixas longas primeiro, depois por horário. */
function byDayOrder(
  a: { isLongRunning: boolean; startTime: string | null; title: string },
  b: { isLongRunning: boolean; startTime: string | null; title: string },
) {
  if (a.isLongRunning !== b.isLongRunning) return a.isLongRunning ? -1 : 1;
  return (a.startTime ?? "").localeCompare(b.startTime ?? "") || a.title.localeCompare(b.title);
}

const HOME_COUPONS = 6;
const HOME_EVENTS = 6;
const HOME_EVENT_DAYS = 14;

/** Home, vitrine de cupons e agenda do app. */
export class FeedQueries {
  constructor(private readonly db: Database) {}

  async highlights(now: Date): Promise<App.Highlight[]> {
    const rows = await this.db.many<{
      id: string;
      title: string;
      subtitle: string | null;
      cta_label: string | null;
      image_url: string | null;
      badge: App.Highlight["badge"];
      target_type: App.Highlight["targetType"];
      target_id: string | null;
      target_url: string | null;
      target_label: string | null;
      target_slug: string | null;
    }>(sql`
      select h.id, h.title, h.subtitle, h.cta_label, h.image_url, h.badge, h.target_type,
             h.target_id, h.target_url,
             case h.target_type
               when 'event' then ev.title
               when 'coupon' then c.title
               when 'store' then s.name
             end as target_label,
             s.slug as target_slug
      from marketing.highlights h
      left join agenda.events ev on h.target_type = 'event' and ev.id = h.target_id
      left join promotions.coupons c on h.target_type = 'coupon' and c.id = h.target_id
      left join directory.stores s on h.target_type = 'store' and s.id = h.target_id
      where h.status = 'published' and h.starts_at <= ${now} and h.ends_at > ${now}
      order by h.sort_order, h.id
    `);
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      subtitle: r.subtitle,
      ctaLabel: r.cta_label,
      imageUrl: r.image_url,
      badge: r.badge,
      targetType: r.target_type,
      targetId: r.target_id,
      targetLabel: r.target_label,
      targetSlug: r.target_slug,
      targetUrl: r.target_url,
    }));
  }

  /** Cupons no ar com estoque, dos que estão mais perto de acabar. */
  async endingCoupons(now: Date, limit = HOME_COUPONS): Promise<App.CouponCard[]> {
    const rows = await this.db.many<CouponCardRow>(sql`
      ${couponCardSelect(now)}
      where ${liveCoupon(now)} and st.taken < c.total_quantity
      order by (c.total_quantity - st.taken)::numeric / c.total_quantity, c.ends_at nulls last, c.id
      limit ${limit}
    `);
    return rows.map(toCouponCard);
  }

  /** Mesmo critério da lista de cupons sem filtro. */
  async liveCouponsCount(now: Date): Promise<number> {
    const row = await this.db.one<{ count: number }>(sql`
      select count(*)::int as count
      from promotions.coupons c
      join directory.stores s on s.id = c.store_id
      where ${liveCoupon(now)}
    `);
    return row.count;
  }

  async upcomingEvents(now: Date, limit = HOME_EVENTS): Promise<App.EventCard[]> {
    const today = toLocal(now).date;
    const rows = await this.db.many<EventRow>(sql`
      ${eventSelect()}
      where ${publishedBetween(today, addDaysToDate(today, HOME_EVENT_DAYS))}
    `);
    return rows
      .map((r) => toEventCard(r, today))
      .filter((e) => e.nextDate !== null)
      .sort((a, b) => (a.nextDate ?? "").localeCompare(b.nextDate ?? "") || byDayOrder(a, b))
      .slice(0, limit);
  }

  async coupons(query: App.ListCouponsQuery, now: Date): Promise<Page<App.CouponCard>> {
    const order =
      query.sort === "ending"
        ? sql`(st.taken >= c.total_quantity), (c.total_quantity - st.taken)::numeric / c.total_quantity, c.id`
        : sql`c.starts_at desc, c.id`;
    const rows = await this.db.many<CouponCardRow & { total: number }>(sql`
      ${couponCardSelect(now, sql`, count(*) over() as total`)}
      ${sql.where([
        liveCoupon(now),
        query.kind && storeHasKind(query.kind),
        query.storeId && sql`c.store_id = ${query.storeId}`,
        query.q &&
          sql`(public.f_unaccent(lower(c.title)) like ${sql.containsPattern(query.q)}
               or public.f_unaccent(lower(s.name)) like ${sql.containsPattern(query.q)})`,
      ])}
      order by ${order}
      limit ${query.pageSize} offset ${offsetOf(query)}
    `);
    return toPage(rows, query, toCouponCard);
  }

  async coupon(
    couponId: string,
    visitorId: string | null,
    now: Date,
  ): Promise<App.CouponDetail | null> {
    const row = await this.db.maybeOne<CouponCardRow>(sql`
      ${couponCardSelect(now)}
      where c.id = ${couponId} and ${liveCoupon(now)}
    `);
    if (!row) return null;
    const myClaim = visitorId ? await this.myActiveClaim(couponId, visitorId, now) : null;
    return { ...toCouponCard(row), myClaim };
  }

  /** Cupom ativo (no prazo) do visitante nesta promoção, se houver. */
  async myActiveClaim(couponId: string, visitorId: string, now: Date): Promise<App.Claim | null> {
    const mine = await this.db.maybeOne<ClaimRow>(sql`
      ${claimSelect}
      where cc.coupon_id = ${couponId} and cc.visitor_id = ${visitorId}
        and cc.status = 'active' and cc.expires_at > ${now}
    `);
    return mine ? toClaim(mine, now) : null;
  }

  isInterested(visitorId: string, eventId: string): Promise<boolean> {
    return this.db.exists(sql`
      select 1 from agenda.event_interests where visitor_id = ${visitorId} and event_id = ${eventId}
    `);
  }

  async claim(claimId: string, visitorId: string, now: Date): Promise<App.Claim | null> {
    const row = await this.db.maybeOne<ClaimRow>(sql`
      ${claimSelect} where cc.id = ${claimId} and cc.visitor_id = ${visitorId}
    `);
    return row ? toClaim(row, now) : null;
  }

  async agenda(query: App.AgendaQuery): Promise<App.Agenda> {
    const rows = await this.db.many<EventRow>(sql`
      ${eventSelect()}
      where ${publishedBetween(query.from, query.to)}
        ${query.categoryId ? sql`and e.category_id = ${query.categoryId}` : sql.empty}
    `);
    const days: App.Agenda["days"] = [];
    for (const date of datesBetween(query.from, query.to)) {
      const events = rows
        .filter((r) =>
          occursOn(
            {
              recurrence: r.recurrence,
              startsOn: r.starts_on,
              endsOn: r.ends_on,
              weekdays: r.weekdays,
            },
            date,
          ),
        )
        .map((r) => {
          const { nextDate: _next, ...event } = toEventCard(r, date);
          return event;
        })
        .sort(byDayOrder);
      if (events.length > 0) days.push({ date, events });
    }
    return { days };
  }

  async event(
    eventId: string,
    visitorId: string | null,
    now: Date,
  ): Promise<App.EventDetail | null> {
    const row = await this.db.maybeOne<EventDetailRow>(sql`
      ${eventSelect(sql`,
        e.description, fl.id as floor_id, fl.label as floor_label, st.id as store_id,
        st.slug as store_slug, st.name as store_name,
        (select count(*) from agenda.event_interests i where i.event_id = e.id) as interests_count,
        exists(select 1 from agenda.event_interests i
               where i.event_id = e.id and i.visitor_id = ${visitorId}::uuid) as is_interested`)}
      left join directory.floors fl on fl.id = e.floor_id
      left join directory.stores st on st.id = e.store_id
      where e.id = ${eventId} and e.status = 'published'
    `);
    if (!row) return null;
    return {
      ...toEventCard(row, toLocal(now).date),
      description: row.description,
      floor: row.floor_id ? { id: row.floor_id, label: row.floor_label ?? "" } : null,
      store: row.store_id
        ? { id: row.store_id, slug: row.store_slug ?? "", name: row.store_name ?? "" }
        : null,
      interestsCount: row.interests_count,
      isInterested: row.is_interested,
    };
  }
}

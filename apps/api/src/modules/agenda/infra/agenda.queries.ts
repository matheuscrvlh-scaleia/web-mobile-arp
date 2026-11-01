import type {
  Event,
  EventCategory,
  EventOccurrences,
  EventRecurrence,
  EventStatus,
  ListEventsQuery,
  Tone,
} from "@arp/contracts";
import { offsetOf, type Page, toPage } from "../../../shared/application/pagination";
import { ValidationError } from "../../../shared/domain/errors";
import { addDaysToDate, daysBetween } from "../../../shared/domain/time";
import type { Database } from "../../../shared/infra/database/database";
import { type SqlFragment, sql } from "../../../shared/infra/database/sql";
import { hhmmOrNull, iso } from "../../../shared/infra/presenters";
import { EventSchedule } from "../domain/event-schedule";

/** Maior intervalo do calendário (dois meses cheios e um pouco). */
const MAX_OCCURRENCE_DAYS = 62;

interface EventRow {
  id: string;
  title: string;
  category_id: string;
  category_name: string;
  category_icon: string;
  description: string;
  image_url: string | null;
  tone: Tone | null;
  icon: string | null;
  place: string;
  floor_id: string | null;
  floor_label: string | null;
  store_id: string | null;
  store_name: string | null;
  recurrence: EventRecurrence;
  starts_on: string;
  ends_on: string | null;
  weekday: number | null;
  start_time: string | null;
  end_time: string | null;
  is_long_running: boolean;
  awards_seal: boolean;
  status: EventStatus;
  interests_count: number;
  created_at: Date;
  updated_at: Date;
}

const EVENT_COLUMNS = sql`
  e.id, e.title, e.category_id, c.name as category_name, c.icon as category_icon,
         e.description, e.image_url, e.tone, e.icon, e.place,
         e.floor_id, f.label as floor_label, e.store_id, s.name as store_name,
         e.recurrence, e.starts_on, e.ends_on, e.weekday, e.start_time, e.end_time,
         e.is_long_running, e.awards_seal, e.status, e.created_at, e.updated_at,
         (select count(*) from agenda.event_interests i where i.event_id = e.id) as interests_count
`;

const EVENT_FROM = sql`
  from agenda.events e
  join agenda.event_categories c on c.id = e.category_id
  left join directory.floors f on f.id = e.floor_id
  left join directory.stores s on s.id = e.store_id
`;

function toEvent(r: EventRow): Event {
  return {
    id: r.id,
    title: r.title,
    category: { id: r.category_id, name: r.category_name, icon: r.category_icon },
    description: r.description,
    imageUrl: r.image_url,
    tone: r.tone,
    icon: r.icon,
    place: r.place,
    floor: r.floor_id ? { id: r.floor_id, label: r.floor_label ?? "" } : null,
    store: r.store_id ? { id: r.store_id, name: r.store_name ?? "" } : null,
    recurrence: r.recurrence,
    startsOn: r.starts_on,
    endsOn: r.ends_on,
    weekday: r.weekday,
    startTime: hhmmOrNull(r.start_time),
    endTime: hhmmOrNull(r.end_time),
    isLongRunning: r.is_long_running,
    awardsSeal: r.awards_seal,
    status: r.status,
    interestsCount: r.interests_count,
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  };
}

/**
 * Eventos que acontecem em algum dia de [from, to] (qualquer ponta aberta).
 * O GiST de active_period acha os candidatos; o semanal ainda precisa ter o
 * dia da semana dentro da interseção (basta olhar no máximo 7 dias).
 */
function happensBetween(from: string | undefined, to: string | undefined): SqlFragment {
  const lo = sql`greatest(e.starts_on, coalesce(${from ?? null}::date, e.starts_on))`;
  const hi = sql`least(coalesce(e.ends_on, 'infinity'::date), coalesce(${to ?? null}::date, 'infinity'::date))`;
  return sql`
    e.active_period && daterange(${from ?? null}::date, ${to ?? null}::date, '[]')
    and (
      e.recurrence <> 'weekly'
      or exists (
        select 1 from generate_series(${lo}, least(${hi}, ${lo} + 6), interval '1 day') d
        where extract(dow from d)::int = e.weekday
      )
    )
  `;
}

export class AgendaQueries {
  constructor(private readonly db: Database) {}

  async listCategories(id?: string): Promise<EventCategory[]> {
    const rows = await this.db.many<{
      id: string;
      name: string;
      icon: string;
      sort_order: number;
      events_count: number;
    }>(sql`
      select c.id, c.name, c.icon, c.sort_order,
             (select count(*) from agenda.events e where e.category_id = c.id) as events_count
      from agenda.event_categories c
      ${sql.where([id && sql`c.id = ${id}`])}
      order by c.sort_order, c.name
    `);
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      icon: r.icon,
      sortOrder: r.sort_order,
      eventsCount: r.events_count,
    }));
  }

  async getCategory(id: string): Promise<EventCategory | null> {
    return (await this.listCategories(id))[0] ?? null;
  }

  async listEvents(query: ListEventsQuery): Promise<Page<Event>> {
    if (query.from && query.to && query.to < query.from) {
      throw ValidationError.field("to", "O fim precisa ser depois do início");
    }
    const rows = await this.db.many<EventRow & { total: number }>(sql`
      select ${EVENT_COLUMNS}, count(*) over() as total
      ${EVENT_FROM}
      ${sql.where([
        query.categoryId && sql`e.category_id = ${query.categoryId}`,
        query.status && sql`e.status = ${query.status}`,
        query.recurrence && sql`e.recurrence = ${query.recurrence}`,
        (query.from || query.to) && happensBetween(query.from, query.to),
        query.q && sql`public.f_unaccent(lower(e.title)) like ${sql.containsPattern(query.q)}`,
      ])}
      order by e.starts_on desc, e.title, e.id
      limit ${query.pageSize} offset ${offsetOf(query)}
    `);
    return toPage(rows, query, toEvent);
  }

  async getEvent(id: string): Promise<Event | null> {
    const row = await this.db.maybeOne<EventRow>(
      sql`select ${EVENT_COLUMNS} ${EVENT_FROM} where e.id = ${id}`,
    );
    return row ? toEvent(row) : null;
  }

  /** Calendário: um item por dia do intervalo, com os eventos daquele dia. */
  async occurrences(from: string, to: string): Promise<EventOccurrences> {
    const span = daysBetween(from, to);
    if (span < 0) throw ValidationError.field("to", "O fim precisa ser depois do início");
    if (span >= MAX_OCCURRENCE_DAYS) {
      throw ValidationError.field("to", `Consulte no máximo ${MAX_OCCURRENCE_DAYS} dias por vez`);
    }
    const rows = await this.db.many<{
      id: string;
      title: string;
      recurrence: EventRecurrence;
      starts_on: string;
      ends_on: string | null;
      weekday: number | null;
      start_time: string | null;
      is_long_running: boolean;
      status: EventStatus;
    }>(sql`
      select e.id, e.title, e.recurrence, e.starts_on, e.ends_on, e.weekday, e.start_time,
             e.is_long_running, e.status
      from agenda.events e
      where e.active_period && daterange(${from}::date, ${to}::date, '[]')
      order by e.is_long_running desc, e.start_time nulls first, e.title
    `);

    const byDate = new Map<string, EventOccurrences["data"][number]["events"]>();
    for (let i = 0; i <= span; i++) byDate.set(addDaysToDate(from, i), []);
    for (const r of rows) {
      const schedule = EventSchedule.restore({
        recurrence: r.recurrence,
        startsOn: r.starts_on,
        endsOn: r.ends_on,
        weekday: r.weekday,
        startTime: hhmmOrNull(r.start_time),
        endTime: null,
      });
      for (const date of schedule.datesBetween(from, to)) {
        byDate.get(date)?.push({
          id: r.id,
          title: r.title,
          isLongRunning: r.is_long_running,
          startTime: hhmmOrNull(r.start_time),
          status: r.status,
        });
      }
    }
    return { data: [...byDate].map(([date, events]) => ({ date, events })) };
  }
}

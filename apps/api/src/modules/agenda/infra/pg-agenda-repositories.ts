import { ConflictError } from "../../../shared/domain/errors";
import type { Database } from "../../../shared/infra/database/database";
import {
  type ConstraintErrors,
  translateConstraintErrors,
  translateInUseError,
} from "../../../shared/infra/database/errors";
import { sql } from "../../../shared/infra/database/sql";
import { hhmmOrNull } from "../../../shared/infra/presenters";
import {
  AgendaEvent,
  type EventStatus,
  type NewAgendaEvent,
  type Tone,
} from "../domain/agenda-event";
import { EventCategory, type NewEventCategory } from "../domain/event-category";
import type { EventPeriod, EventRecurrence } from "../domain/event-schedule";
import type {
  AgendaEventRepository,
  AgendaReferences,
  EventCategoryRepository,
  SiteImportLog,
  SiteLink,
} from "../domain/repositories";

/* Categorias ------------------------------------------------------------- */

interface CategoryRow {
  id: string;
  name: string;
  icon: string;
  sort_order: number;
}

const categoryToDomain = (r: CategoryRow) =>
  EventCategory.restore({ id: r.id, name: r.name, icon: r.icon, sortOrder: r.sort_order });

const CATEGORY_ERRORS: ConstraintErrors = {
  event_categories_name_key: () => new ConflictError("Já existe uma categoria com esse nome"),
};

export class PgEventCategoryRepository implements EventCategoryRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<EventCategory | null> {
    const row = await this.db.maybeOne<CategoryRow>(sql`
      select id, name, icon, sort_order from agenda.event_categories where id = ${id}
    `);
    return row ? categoryToDomain(row) : null;
  }

  async create(data: NewEventCategory): Promise<EventCategory> {
    const row = await translateConstraintErrors(
      () =>
        this.db.one<CategoryRow>(sql`
          insert into agenda.event_categories (name, icon, sort_order)
          values (${data.name}, ${data.icon}, ${data.sortOrder})
          returning id, name, icon, sort_order
        `),
      CATEGORY_ERRORS,
    );
    return categoryToDomain(row);
  }

  async save(category: EventCategory): Promise<void> {
    const s = category.toState();
    await translateConstraintErrors(
      () =>
        this.db.query(sql`
          update agenda.event_categories
          set name = ${s.name}, icon = ${s.icon}, sort_order = ${s.sortOrder}
          where id = ${s.id}
        `),
      CATEGORY_ERRORS,
    );
  }

  async delete(id: string): Promise<void> {
    await translateInUseError(
      () => this.db.query(sql`delete from agenda.event_categories where id = ${id}`),
      () =>
        new ConflictError("Há eventos nesta categoria. Mude a categoria deles antes de apagar."),
    );
  }
}

/* Eventos ---------------------------------------------------------------- */

interface EventRow {
  id: string;
  title: string;
  category_id: string;
  description: string;
  image_url: string | null;
  tone: Tone | null;
  icon: string | null;
  place: string;
  floor_id: string | null;
  store_id: string | null;
  recurrence: EventRecurrence;
  starts_on: string;
  ends_on: string | null;
  weekdays: number[] | null;
  periods: EventPeriod[] | null;
  start_time: string | null;
  end_time: string | null;
  is_long_running: boolean;
  awards_seal: boolean;
  ticket_url: string | null;
  status: EventStatus;
  archived_at: Date | null;
}

const EVENT_COLUMNS = sql.raw(`id, title, category_id, description, image_url, tone, icon, place,
  floor_id, store_id, recurrence, starts_on, ends_on, weekdays, periods, start_time, end_time,
  is_long_running, awards_seal, ticket_url, status, archived_at`);

const eventToDomain = (r: EventRow) =>
  AgendaEvent.restore({
    id: r.id,
    title: r.title,
    categoryId: r.category_id,
    description: r.description,
    imageUrl: r.image_url,
    tone: r.tone,
    icon: r.icon,
    place: r.place,
    floorId: r.floor_id,
    storeId: r.store_id,
    recurrence: r.recurrence,
    startsOn: r.starts_on,
    endsOn: r.ends_on,
    weekdays: r.weekdays,
    periods: r.periods,
    startTime: hhmmOrNull(r.start_time),
    endTime: hhmmOrNull(r.end_time),
    isLongRunning: r.is_long_running,
    awardsSeal: r.awards_seal,
    ticketUrl: r.ticket_url,
    status: r.status,
    archivedAt: r.archived_at,
  });

/** jsonb dos períodos (null = um período só). */
const periodsJson = (periods: EventPeriod[] | null) => (periods ? JSON.stringify(periods) : null);

/** weekday (legado do app) = primeiro dia da lista. */
const firstDay = (days: number[] | null) => days?.[0] ?? null;

export class PgAgendaEventRepository implements AgendaEventRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<AgendaEvent | null> {
    const row = await this.db.maybeOne<EventRow>(
      sql`select ${EVENT_COLUMNS} from agenda.events where id = ${id}`,
    );
    return row ? eventToDomain(row) : null;
  }

  async create(d: NewAgendaEvent): Promise<AgendaEvent> {
    const row = await this.db.one<EventRow>(sql`
      insert into agenda.events
        (title, category_id, description, image_url, tone, icon, place, floor_id, store_id,
         recurrence, starts_on, ends_on, weekday, weekdays, periods, start_time, end_time,
         is_long_running, awards_seal, ticket_url, status)
      values
        (${d.title}, ${d.categoryId}, ${d.description}, ${d.imageUrl}, ${d.tone}, ${d.icon},
         ${d.place}, ${d.floorId}, ${d.storeId}, ${d.recurrence}, ${d.startsOn}::date,
         ${d.endsOn}::date, ${firstDay(d.weekdays)}, ${d.weekdays}::smallint[],
         ${periodsJson(d.periods)}::jsonb, ${d.startTime}::time, ${d.endTime}::time,
         ${d.isLongRunning}, ${d.awardsSeal}, ${d.ticketUrl}, ${d.status})
      returning ${EVENT_COLUMNS}
    `);
    return eventToDomain(row);
  }

  async save(event: AgendaEvent): Promise<void> {
    const s = event.toState();
    await this.db.query(sql`
      update agenda.events
      set title = ${s.title}, category_id = ${s.categoryId}, description = ${s.description},
          image_url = ${s.imageUrl}, tone = ${s.tone}, icon = ${s.icon}, place = ${s.place},
          floor_id = ${s.floorId}, store_id = ${s.storeId}, recurrence = ${s.recurrence},
          starts_on = ${s.startsOn}::date, ends_on = ${s.endsOn}::date,
          weekday = ${firstDay(s.weekdays)}, weekdays = ${s.weekdays}::smallint[],
          periods = ${periodsJson(s.periods)}::jsonb, ticket_url = ${s.ticketUrl},
          start_time = ${s.startTime}::time, end_time = ${s.endTime}::time,
          is_long_running = ${s.isLongRunning}, awards_seal = ${s.awardsSeal}, status = ${s.status},
          archived_at = ${s.archivedAt}
      where id = ${s.id}
    `);
  }

  async delete(id: string): Promise<void> {
    await translateInUseError(
      () => this.db.query(sql`delete from agenda.events where id = ${id}`),
      () => new ConflictError("Este evento está ligado a um desafio. Remova o vínculo antes."),
    );
  }

  async countInterests(id: string): Promise<number> {
    const { n } = await this.db.one<{ n: number }>(
      sql`select count(*) as n from agenda.event_interests where event_id = ${id}`,
    );
    return n;
  }
}

/* Referências ------------------------------------------------------------ */

export class PgAgendaReferences implements AgendaReferences {
  constructor(private readonly db: Database) {}

  categoryExists(id: string): Promise<boolean> {
    return this.db.exists(sql`select 1 from agenda.event_categories where id = ${id}`);
  }

  floorExists(id: string): Promise<boolean> {
    return this.db.exists(sql`select 1 from directory.floors where id = ${id}`);
  }

  storeExists(id: string): Promise<boolean> {
    return this.db.exists(sql`select 1 from directory.stores where id = ${id}`);
  }
}

/* Sincronização com o site ----------------------------------------------- */

export class PgSiteImportLog implements SiteImportLog {
  constructor(private readonly db: Database) {}

  async all(): Promise<SiteLink[]> {
    const rows = await this.db.many<{ site_id: number; event_id: string | null }>(
      sql`select site_id, event_id from agenda.site_event_imports`,
    );
    return rows.map((r) => ({ siteId: r.site_id, eventId: r.event_id }));
  }

  async record(e: { siteId: number; eventId: string; siteUrl: string }): Promise<void> {
    // Post cujo evento foi apagado aqui (event_id null) volta ligado ao novo.
    const row = await this.db.maybeOne(sql`
      insert into agenda.site_event_imports (site_id, event_id, site_url)
      values (${e.siteId}, ${e.eventId}, ${e.siteUrl})
      on conflict (site_id) do update
        set event_id = excluded.event_id, site_url = excluded.site_url, imported_at = now()
        where agenda.site_event_imports.event_id is null
      returning site_id
    `);
    if (!row)
      throw new ConflictError("Outra sincronização com o site está em andamento. Tente de novo.");
  }
}

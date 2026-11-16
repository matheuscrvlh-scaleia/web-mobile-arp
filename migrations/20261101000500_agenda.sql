-- agenda: categorias de evento, eventos (um dia, período ou semanal) e
-- interesse dos visitantes. Ninguém cadastra dia a dia: as ocorrências são
-- calculadas a partir da recorrência.

create schema if not exists agenda;

comment on schema agenda is 'Agenda de eventos da ARP.';

/* Categorias ------------------------------------------------------------- */

create table agenda.event_categories (
  id         uuid primary key default public.uuid_generate_v7(),
  name       text not null,
  icon       text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_categories_name_key unique (name),
  constraint event_categories_name_not_blank check (btrim(name) <> ''),
  constraint event_categories_icon_format check (icon ~ '^[a-z0-9-]+$')
);

create trigger event_categories_set_updated_at
  before update on agenda.event_categories
  for each row when (old.* is distinct from new.*)
  execute function public.set_updated_at();

/* Eventos ---------------------------------------------------------------- */

create table agenda.events (
  id              uuid primary key default public.uuid_generate_v7(),
  title           text not null,
  category_id     uuid not null references agenda.event_categories (id),
  description     text not null default '',
  image_url       text,
  tone            text,
  icon            text,
  place           text not null,
  floor_id        uuid references directory.floors (id),
  store_id        uuid references directory.stores (id),
  recurrence      text not null,
  starts_on       date not null,
  ends_on         date,
  weekday         smallint,
  start_time      time,
  end_time        time,
  is_long_running boolean not null default false,
  awards_seal     boolean not null default false,
  status          text not null default 'draft',
  -- Dias em que o evento pode acontecer, já resolvido pela recorrência
  -- (single = só starts_on; weekly sem fim = até o infinito). Serve à busca
  -- "eventos que acontecem no intervalo" com índice GiST.
  active_period   daterange generated always as (
    daterange(
      starts_on,
      case recurrence when 'single' then starts_on else ends_on end,
      '[]'
    )
  ) stored,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint events_title_not_blank check (btrim(title) <> ''),
  constraint events_place_not_blank check (btrim(place) <> ''),
  constraint events_tone_check check (tone in ('green', 'ink', 'clay', 'sand', 'deep')),
  constraint events_icon_format check (icon ~ '^[a-z0-9-]+$'),
  constraint events_recurrence_check check (recurrence in ('single', 'range', 'weekly')),
  constraint events_status_check check (status in ('draft', 'published', 'cancelled')),
  constraint events_weekday_range check (weekday between 0 and 6),
  -- Coerência da recorrência (o mesmo que recurrenceIssues() do contrato):
  -- single: um dia, sem fim nem dia da semana; range: precisa do último dia;
  -- weekly: precisa do dia da semana (fim opcional).
  constraint events_recurrence_shape check (
    case recurrence
      when 'single' then ends_on is null and weekday is null
      when 'range' then ends_on is not null and weekday is null
      when 'weekly' then weekday is not null
    end
  ),
  constraint events_dates_order check (ends_on is null or ends_on >= starts_on),
  constraint events_end_time_needs_start check (end_time is null or start_time is not null)
);

comment on column agenda.events.starts_on is 'single: o dia. range: primeiro dia. weekly: a partir de quando vale.';
comment on column agenda.events.ends_on is 'range: último dia. weekly: até quando (null = sem fim). single: sempre null.';
comment on column agenda.events.weekday is 'weekly: 0 = domingo … 6 = sábado.';
comment on column agenda.events.end_time is 'Hora local (America/Sao_Paulo). end_time < start_time = termina depois da meia-noite.';
comment on column agenda.events.is_long_running is 'Aparece como faixa em todos os dias da agenda (ex.: Corredor Cultural, o mês inteiro).';
comment on column agenda.events.awards_seal is 'Participar vale selo (um desafio de gamification aponta para o evento).';
comment on column agenda.events.active_period is
  'Gerada. Use active_period && daterange($from, $to, ''[]'') para achar eventos no intervalo; weekly ainda filtra o dia da semana na API.';

-- Listagens por status ordenadas por data (spec do modelo).
create index events_status_dates_idx on agenda.events (status, starts_on, ends_on);
-- Calendário/ocorrências e filtro from/to: sobreposição de intervalos.
create index events_active_period_idx on agenda.events using gist (active_period);
create index events_category_id_idx on agenda.events (category_id);
create index events_floor_id_idx on agenda.events (floor_id) where floor_id is not null;
create index events_store_id_idx on agenda.events (store_id) where store_id is not null;
create index events_title_trgm_idx on agenda.events
  using gin (public.f_unaccent(lower(title)) extensions.gin_trgm_ops);

-- Sem WHEN aqui: condição de trigger BEFORE não pode ler colunas geradas
-- (active_period) de NEW, e old.*/new.* as incluiriam.
create trigger events_set_updated_at
  before update on agenda.events
  for each row
  execute function public.set_updated_at();

/* Interesse ("Tenho interesse") ------------------------------------------ */

create table agenda.event_interests (
  visitor_id uuid not null references visitors.visitors (id) on delete cascade,
  event_id   uuid not null references agenda.events (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint event_interests_pkey primary key (visitor_id, event_id)
);

comment on table agenda.event_interests is 'Eventos salvos pelo visitante (lembrete no dia). interestsCount do evento.';

create index event_interests_event_id_idx on agenda.event_interests (event_id);

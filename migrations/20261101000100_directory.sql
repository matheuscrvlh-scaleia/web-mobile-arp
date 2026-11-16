-- directory: andares (com o desenho do mapa), blocos, categorias, lojas,
-- horários e pontos de referência do mapa.

create schema if not exists directory;

comment on schema directory is 'Guia de lojas e mapa por andar.';

/* Andares ---------------------------------------------------------------- */

create table directory.floors (
  id          uuid primary key default public.uuid_generate_v7(),
  level       integer not null,
  label       text not null,
  short_label text not null,
  layout      jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint floors_level_key unique (level),
  constraint floors_level_range check (level between -5 and 50),
  constraint floors_label_not_blank check (btrim(label) <> ''),
  constraint floors_short_label_len check (char_length(short_label) between 1 and 3),
  constraint floors_layout_is_array check (jsonb_typeof(layout) = 'array')
);

comment on column directory.floors.level is '0 = térreo, 1 = 1º andar…, negativo = subsolo. Ordena os botões de andar.';
comment on column directory.floors.layout is
  'Desenho do andar: array de MapShape {kind, label, x, y, w, h} no viewBox 360x470 do app. Validado pelo contrato (Zod) na API.';

create trigger floors_set_updated_at
  before update on directory.floors
  for each row when (old.* is distinct from new.*)
  execute function public.set_updated_at();

/* Blocos ----------------------------------------------------------------- */

create table directory.blocks (
  id         uuid primary key default public.uuid_generate_v7(),
  name       text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint blocks_name_key unique (name),
  constraint blocks_name_not_blank check (btrim(name) <> '')
);

comment on table directory.blocks is 'Prédios do complexo (ex.: "Bloco 80").';

create trigger blocks_set_updated_at
  before update on directory.blocks
  for each row when (old.* is distinct from new.*)
  execute function public.set_updated_at();

/* Categorias de loja ----------------------------------------------------- */

create table directory.store_categories (
  id         uuid primary key default public.uuid_generate_v7(),
  name       text not null,
  kind       text not null,
  icon       text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_categories_name_kind_key unique (name, kind),
  constraint store_categories_kind_check check (kind in ('food', 'shop')),
  constraint store_categories_name_not_blank check (btrim(name) <> ''),
  constraint store_categories_icon_format check (icon ~ '^[a-z0-9-]+$')
);

comment on column directory.store_categories.kind is 'food = Alimentação, shop = Lojas e serviços (as duas abas do app).';
comment on column directory.store_categories.icon is 'Nome do ícone lucide em kebab-case.';

create trigger store_categories_set_updated_at
  before update on directory.store_categories
  for each row when (old.* is distinct from new.*)
  execute function public.set_updated_at();

/* Lojas ------------------------------------------------------------------ */

create table directory.stores (
  id              uuid primary key default public.uuid_generate_v7(),
  slug            text not null,
  name            text not null,
  category_id     uuid not null references directory.store_categories (id),
  block_id        uuid not null references directory.blocks (id),
  floor_id        uuid not null references directory.floors (id),
  description     text not null default '',
  icon            text not null,
  brand_color     text not null,
  cover_image_url text,
  logo_url        text,
  phone           text,
  whatsapp        text,
  instagram       text,
  website         text,
  map_x           numeric(6, 2),
  map_y           numeric(6, 2),
  status          text not null default 'active',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint stores_slug_key unique (slug),
  constraint stores_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint stores_name_not_blank check (btrim(name) <> ''),
  constraint stores_icon_format check (icon ~ '^[a-z0-9-]+$'),
  constraint stores_brand_color_format check (brand_color ~ '^#[0-9a-fA-F]{6}$'),
  constraint stores_status_check check (status in ('active', 'inactive')),
  constraint stores_map_x_range check (map_x between 0 and 360),
  constraint stores_map_y_range check (map_y between 0 and 470),
  constraint stores_map_position_pair check ((map_x is null) = (map_y is null))
);

comment on column directory.stores.slug is 'Identificador estável usado em links do app (arp://loja/<slug>).';
comment on column directory.stores.map_x is 'Posição do pino no desenho do andar (viewBox 360x470). Nulo = loja fora do mapa.';
comment on column directory.stores.status is 'inactive = some do app; lojas não são apagadas (histórico de cupons).';

-- Filtros da listagem (FKs também servem às checagens "apagar sem lojas" e
-- às contagens storesCount por categoria/bloco/andar).
create index stores_category_id_idx on directory.stores (category_id);
create index stores_block_id_idx on directory.stores (block_id);
create index stores_floor_id_idx on directory.stores (floor_id);
-- Listagem padrão: filtra por status e ordena por nome.
create index stores_status_name_idx on directory.stores (status, name);
-- Busca sem acento por trecho do nome: public.f_unaccent(lower(name)) like '%' || public.f_unaccent(lower($q)) || '%'.
create index stores_name_trgm_idx on directory.stores
  using gin (public.f_unaccent(lower(name)) extensions.gin_trgm_ops);

create trigger stores_set_updated_at
  before update on directory.stores
  for each row when (old.* is distinct from new.*)
  execute function public.set_updated_at();

/* Horários --------------------------------------------------------------- */

create table directory.store_hours (
  store_id  uuid not null references directory.stores (id) on delete cascade,
  weekday   smallint not null,
  opens_at  time not null,
  closes_at time not null,
  constraint store_hours_pkey primary key (store_id, weekday),
  constraint store_hours_weekday_range check (weekday between 0 and 6)
);

comment on table directory.store_hours is
  'Um horário por dia da semana. Dia sem linha = fechado. A API substitui todas as linhas da loja ao editar.';
comment on column directory.store_hours.weekday is '0 = domingo … 6 = sábado (igual a Date.getDay()).';
comment on column directory.store_hours.closes_at is
  'closes_at <= opens_at significa que passa da meia-noite (ex.: 16:00 às 00:30). "Aberto agora" é calculado em America/Sao_Paulo.';

/* Pontos do mapa --------------------------------------------------------- */

create table directory.map_points (
  id         uuid primary key default public.uuid_generate_v7(),
  floor_id   uuid not null references directory.floors (id) on delete cascade,
  icon       text not null,
  label      text not null,
  x          numeric(6, 2) not null,
  y          numeric(6, 2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint map_points_icon_format check (icon ~ '^[a-z0-9-]+$'),
  constraint map_points_label_not_blank check (btrim(label) <> ''),
  constraint map_points_x_range check (x between 0 and 360),
  constraint map_points_y_range check (y between 0 and 470)
);

comment on table directory.map_points is 'Pontos de referência que não são lojas (reciclagem, estacionamento, início do tour…).';

create index map_points_floor_id_idx on directory.map_points (floor_id);

create trigger map_points_set_updated_at
  before update on directory.map_points
  for each row when (old.* is distinct from new.*)
  execute function public.set_updated_at();

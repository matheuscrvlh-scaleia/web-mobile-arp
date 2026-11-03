-- content (Fase 2): textos da ARP, Circuito Cultural, Sustentarp e vagas.

create schema if not exists content;

comment on schema content is 'Conteúdo editável da ARP: textos, Circuito Cultural, Sustentarp e vagas.';

/* Textos ----------------------------------------------------------------- */

create table content.pages (
  key        text primary key,
  title      text not null,
  body       text not null default '',
  file_url   text,
  updated_by uuid references identity.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint pages_key_check check (key in ('history', 'rules', 'club_rules', 'circuit')),
  constraint pages_title_not_blank check (btrim(title) <> '')
);

alter table content.pages enable row level security;

comment on table content.pages is
  'Textos editáveis. history = Nossa história; rules = Regras da ARP (file_url = PDF); club_rules = Regulamento do Clube ARP; circuit = abertura do Circuito Cultural (file_url = imagem do mapa). Sem linha = texto ainda não escrito.';

/* Circuito Cultural ------------------------------------------------------ */

create table content.art_points (
  id          uuid primary key default public.uuid_generate_v7(),
  number      integer not null,
  name        text not null,
  artist      text not null default '',
  place       text not null default '',
  kind        text not null,
  description text not null default '',
  image_url   text,
  map_x       numeric(5, 2),
  map_y       numeric(5, 2),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint art_points_number_key unique (number),
  constraint art_points_kind_check check (kind in ('work', 'memory', 'sculpture', 'mural')),
  constraint art_points_name_not_blank check (btrim(name) <> ''),
  constraint art_points_location_pair check ((map_x is null) = (map_y is null)),
  constraint art_points_map_range check (
    map_x is null or (map_x between 0 and 100 and map_y between 0 and 100))
);

alter table content.art_points enable row level security;

comment on table content.art_points is 'Pontos de arte do Circuito Cultural (número como no mapa da ARP).';
comment on column content.art_points.kind is 'work = obra, memory = memória, sculpture = escultura, mural = mural e grafite.';
comment on column content.art_points.map_x is 'Posição no mapa do Circuito, em % da largura (0–100).';

create trigger art_points_set_updated_at
  before update on content.art_points
  for each row when (old.* is distinct from new.*)
  execute function public.set_updated_at();

/* Sustentarp ------------------------------------------------------------- */

create table content.recycling_items (
  id          uuid primary key default public.uuid_generate_v7(),
  name        text not null,
  icon        text not null,
  accepts     text not null default '',
  rejects     text not null default '',
  becomes     text not null default '',
  gives_seal  boolean not null default false,
  sort_order  integer not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint recycling_items_name_key unique (name),
  constraint recycling_items_name_not_blank check (btrim(name) <> ''),
  constraint recycling_items_icon_format check (icon ~ '^[a-z0-9-]+$')
);

alter table content.recycling_items enable row level security;

comment on table content.recycling_items is
  'O que o Sustentarp recebe: o que aceita, o que não aceita e o que vira. gives_seal = conta para o desafio de descarte.';

create trigger recycling_items_set_updated_at
  before update on content.recycling_items
  for each row when (old.* is distinct from new.*)
  execute function public.set_updated_at();

/* Vagas ------------------------------------------------------------------ */

create table content.jobs (
  id           uuid primary key default public.uuid_generate_v7(),
  store_id     uuid not null references directory.stores (id) on delete cascade,
  title        text not null,
  text         text not null default '',
  image_url    text,
  whatsapp     text not null,
  published_at timestamptz not null default now(),
  expires_at   timestamptz not null,
  created_by   uuid references identity.users (id) on delete set null,
  constraint jobs_title_not_blank check (btrim(title) <> ''),
  constraint jobs_text_or_image check (btrim(text) <> '' or image_url is not null),
  constraint jobs_whatsapp_format check (whatsapp ~ '^\d{10,13}$'),
  constraint jobs_expires_after_publish check (expires_at > published_at)
);

create index jobs_live_idx on content.jobs (expires_at desc);
create index jobs_store_idx on content.jobs (store_id, expires_at desc);

alter table content.jobs enable row level security;

comment on table content.jobs is
  'Vagas de emprego das lojas. Saem do app sozinhas em expires_at (published_at + jobDays das configurações, padrão 30). Tirar do ar antes = apagar a linha.';

/* Permissões ------------------------------------------------------------- */

-- O cargo do sistema (Administrador) tem todas as permissões, inclusive as novas.
update identity.roles
set permissions = array(
  select distinct p from unnest(
    permissions || array['content.view', 'content.manage', 'jobs.view', 'jobs.manage']) p
  order by p)
where is_system;

/* Acesso ----------------------------------------------------------------- */

-- Igual aos outros schemas (20261101001000_security): anon/authenticated sem acesso.
do $$
declare
  r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if not exists (select 1 from pg_roles where rolname = r) then
      continue;
    end if;
    execute format('revoke all on all tables in schema content from %I', r);
    execute format('revoke usage, create on schema content from %I', r);
    execute format('alter default privileges in schema content revoke all on tables from %I', r);
  end loop;
end
$$;

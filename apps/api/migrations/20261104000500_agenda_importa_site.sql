-- Agenda: eventos importados do site (espacoarp.com.br, WordPress) e o
-- status "pausado" (sai do app e volta com "Continuar", sem virar rascunho).

alter table agenda.events drop constraint events_status_check;
alter table agenda.events add constraint events_status_check
  check (status in ('draft', 'published', 'paused', 'cancelled'));

-- Um registro por post do site já importado. Fica mesmo se o evento for
-- apagado aqui (event_id vira null): assim a próxima importação não traz de
-- volta o que o gestor descartou.
create table agenda.site_event_imports (
  site_id     integer primary key,
  event_id    uuid references agenda.events (id) on delete set null,
  site_url    text not null,
  imported_at timestamptz not null default now()
);

comment on table agenda.site_event_imports is
  'Posts do tipo "evento" do site já importados para a agenda (site_id = id do post no WordPress).';

create unique index site_event_imports_event_id_key
  on agenda.site_event_imports (event_id) where event_id is not null;

alter table agenda.site_event_imports enable row level security;

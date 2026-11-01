-- platform: configurações do app (chave/valor).

create schema if not exists platform;

comment on schema platform is 'Configurações gerais do app.';

create table platform.settings (
  key        text primary key,
  value      jsonb not null,
  updated_by uuid references identity.users (id),
  updated_at timestamptz not null default now(),
  constraint settings_key_format check (key ~ '^[a-z][a-zA-Z0-9]*$')
);

comment on table platform.settings is
  'Uma linha por chave de appSettingsSchema (@arp/contracts), ex.: couponDefaultWindowHours. O valor é validado pelo contrato na API.';
comment on column platform.settings.updated_by is 'Último usuário do painel que alterou (null = seed/sistema).';

create trigger settings_set_updated_at
  before update on platform.settings
  for each row when (old.* is distinct from new.*)
  execute function public.set_updated_at();

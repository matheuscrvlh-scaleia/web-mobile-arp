-- visitors: contas do app do visitante (não acessam o painel), lojas
-- favoritas, lojas seguidas ("Avisar ofertas") e tokens de push.

create schema if not exists visitors;

comment on schema visitors is 'Contas do app do visitante e suas preferências.';

/* Visitantes ------------------------------------------------------------- */

create table visitors.visitors (
  id                uuid primary key default public.uuid_generate_v7(),
  name              text not null,
  email             text not null,
  phone             text,
  password_hash     text,
  auth_provider     text not null default 'password',
  provider_subject  text,
  avatar_url        text,
  marketing_opt_in  boolean not null default false,
  terms_accepted_at timestamptz,
  status            text not null default 'active',
  blocked_reason    text,
  last_seen_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint visitors_name_not_blank check (btrim(name) <> ''),
  constraint visitors_email_format check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  constraint visitors_auth_provider_check check (auth_provider in ('password', 'google', 'apple')),
  -- Conta por senha precisa de hash; login social precisa do "sub" do provedor.
  constraint visitors_credentials_check check (
    case auth_provider
      when 'password' then password_hash is not null
      else provider_subject is not null
    end
  ),
  constraint visitors_status_check check (status in ('active', 'blocked')),
  constraint visitors_blocked_reason_check check (status <> 'blocked' or blocked_reason is not null)
);

comment on column visitors.visitors.password_hash is 'argon2id; nulo em login social (Google/Apple).';
comment on column visitors.visitors.provider_subject is 'Id estável do usuário no provedor social (claim "sub" do id_token).';
comment on column visitors.visitors.marketing_opt_in is 'Aceite de comunicação (LGPD), separado do aceite dos termos. Público "opted_in" das notificações.';
comment on column visitors.visitors.last_seen_at is 'Última atividade no app (atualizada no refresh da sessão).';

create unique index visitors_email_key on visitors.visitors (lower(email));
create unique index visitors_provider_subject_key on visitors.visitors (auth_provider, provider_subject)
  where provider_subject is not null;
-- Busca do painel por nome (sem acento) e por trecho do e-mail.
create index visitors_name_trgm_idx on visitors.visitors
  using gin (public.f_unaccent(lower(name)) extensions.gin_trgm_ops);
create index visitors_email_trgm_idx on visitors.visitors
  using gin (lower(email) extensions.gin_trgm_ops);
-- Listagem (mais recentes primeiro) e novos cadastros por período no dashboard.
create index visitors_created_at_idx on visitors.visitors (created_at);
-- Estimativa/envio do público "opted_in" sem varrer a tabela.
create index visitors_opted_in_idx on visitors.visitors (id)
  where marketing_opt_in and status = 'active';

create trigger visitors_set_updated_at
  before update on visitors.visitors
  for each row when (old.* is distinct from new.*)
  execute function public.set_updated_at();

/* Favoritos -------------------------------------------------------------- */

create table visitors.favorite_stores (
  visitor_id uuid not null references visitors.visitors (id) on delete cascade,
  store_id   uuid not null references directory.stores (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint favorite_stores_pkey primary key (visitor_id, store_id)
);

-- favoritesCount da loja (a PK cobre a consulta por visitante).
create index favorite_stores_store_id_idx on visitors.favorite_stores (store_id);

/* Lojas seguidas --------------------------------------------------------- */

create table visitors.store_follows (
  visitor_id uuid not null references visitors.visitors (id) on delete cascade,
  store_id   uuid not null references directory.stores (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint store_follows_pkey primary key (visitor_id, store_id)
);

comment on table visitors.store_follows is '"Avisar ofertas": público store_followers das notificações da loja.';

-- followersCount e público da notificação por loja.
create index store_follows_store_id_idx on visitors.store_follows (store_id);

/* Tokens de push --------------------------------------------------------- */

create table visitors.push_tokens (
  id           uuid primary key default public.uuid_generate_v7(),
  visitor_id   uuid not null references visitors.visitors (id) on delete cascade,
  token        text not null,
  platform     text not null,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint push_tokens_token_key unique (token),
  constraint push_tokens_platform_check check (platform in ('ios', 'android'))
);

comment on table visitors.push_tokens is 'Tokens do Expo Push por aparelho. Token repetido troca de dono (upsert por token).';

create index push_tokens_visitor_id_idx on visitors.push_tokens (visitor_id);

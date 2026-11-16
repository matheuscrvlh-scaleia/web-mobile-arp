-- identity: cargos (RBAC), usuários do painel e sessões (refresh tokens do
-- painel e do app). Autenticação é toda feita pela API, não pelo Supabase Auth.

create schema if not exists identity;

comment on schema identity is 'Equipe do painel, cargos/permissões e sessões de login.';

/* Cargos ----------------------------------------------------------------- */

create table identity.roles (
  id          uuid primary key default public.uuid_generate_v7(),
  name        text not null,
  description text,
  permissions text[] not null default '{}',
  is_system   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint roles_name_key unique (name),
  constraint roles_name_not_blank check (btrim(name) <> ''),
  constraint roles_permissions_no_nulls check (array_position(permissions, null) is null)
);

comment on column identity.roles.permissions is
  'Chaves de PERMISSIONS (@arp/contracts), ex.: coupons.manage. Validadas na API; vão para o JWT.';
comment on column identity.roles.is_system is 'Cargo do sistema (Administrador): não pode ser apagado nem perder permissões.';

create trigger roles_set_updated_at
  before update on identity.roles
  for each row when (old.* is distinct from new.*)
  execute function public.set_updated_at();

/* Usuários do painel ----------------------------------------------------- */

create table identity.users (
  id                   uuid primary key default public.uuid_generate_v7(),
  name                 text not null,
  email                text not null,
  password_hash        text not null,
  role_id              uuid not null references identity.roles (id),
  store_id             uuid references directory.stores (id),
  status               text not null default 'active',
  must_change_password boolean not null default true,
  last_login_at        timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint users_name_not_blank check (btrim(name) <> ''),
  constraint users_email_format check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  constraint users_status_check check (status in ('active', 'disabled'))
);

comment on column identity.users.password_hash is 'argon2id (formato PHC: $argon2id$v=19$...).';
comment on column identity.users.store_id is 'Preenchido = lojista: a API força o escopo da loja nas leituras e na validação de cupons.';
comment on column identity.users.must_change_password is 'true após criar com senha provisória ou reset: o painel obriga a trocar.';

-- E-mail único sem diferenciar maiúsculas (login faz lower(email) = lower($1)).
create unique index users_email_key on identity.users (lower(email));
create index users_role_id_idx on identity.users (role_id);
create index users_store_id_idx on identity.users (store_id) where store_id is not null;

create trigger users_set_updated_at
  before update on identity.users
  for each row when (old.* is distinct from new.*)
  execute function public.set_updated_at();

/* Sessões ---------------------------------------------------------------- */

create table identity.sessions (
  id             uuid primary key default public.uuid_generate_v7(),
  audience       text not null,
  subject_id     uuid not null,
  family_id      uuid not null,
  token_hash     text not null,
  expires_at     timestamptz not null,
  revoked_at     timestamptz,
  replaced_by_id uuid references identity.sessions (id) on delete set null,
  user_agent     text,
  ip             inet,
  created_at     timestamptz not null default now(),
  last_used_at   timestamptz,
  constraint sessions_token_hash_key unique (token_hash),
  constraint sessions_token_hash_format check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint sessions_audience_check check (audience in ('admin', 'app')),
  constraint sessions_expires_after_created check (expires_at > created_at)
);

comment on table identity.sessions is
  'Refresh tokens opacos e rotativos. Cada uso gera uma linha nova na mesma família; reuso de token já rotacionado revoga a família.';
comment on column identity.sessions.subject_id is
  'identity.users.id (audience admin) ou visitors.visitors.id (audience app). Sem FK por ser polimórfico.';
comment on column identity.sessions.family_id is 'Todas as rotações de um mesmo login. Revogar a família = derrubar o login.';
comment on column identity.sessions.token_hash is 'SHA-256 (hex) do token. O token em si nunca é gravado.';
comment on column identity.sessions.replaced_by_id is 'Sessão que substituiu esta na rotação (null = ainda é a atual da família).';

-- Sessões de um usuário (logout geral, bloqueio de visitante).
create index sessions_subject_idx on identity.sessions (subject_id, audience);
-- Revogar a família inteira na detecção de reuso.
create index sessions_family_id_idx on identity.sessions (family_id);
-- Job de limpeza de expiradas.
create index sessions_expires_at_idx on identity.sessions (expires_at);

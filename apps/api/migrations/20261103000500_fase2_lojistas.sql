/*
 * Fase 2: cadastro de lojista pelo link e permissões por pessoa.
 *
 * - A ARP gera um link para a loja (merchant_invites, token guardado só como
 *   hash). Quem abre se cadastra (merchant_signups, pendente) e só entra
 *   depois que alguém com `merchants.approve` aprova: aí o usuário do painel
 *   é criado com o cargo Lojista e a loja do link.
 * - Permissões novas: gerar QR Code, gerenciar o Clube, ver relatórios e
 *   aprovar lojistas (cada pessoa recebe só o que precisa).
 */

create table identity.merchant_invites (
  id         uuid primary key default public.uuid_generate_v7(),
  token_hash text not null,
  store_id   uuid not null references directory.stores (id) on delete cascade,
  created_by uuid references identity.users (id) on delete set null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint merchant_invites_token_key unique (token_hash)
);

alter table identity.merchant_invites enable row level security;

comment on table identity.merchant_invites is
  'Link de cadastro de lojista (vale até expires_at, para mais de uma pessoa da mesma loja).';

create table identity.merchant_signups (
  id            uuid primary key default public.uuid_generate_v7(),
  invite_id     uuid references identity.merchant_invites (id) on delete set null,
  store_id      uuid not null references directory.stores (id) on delete cascade,
  name          text not null,
  email         text not null,
  phone         text,
  password_hash text not null,
  status        text not null default 'pending',
  user_id       uuid references identity.users (id) on delete set null,
  decided_by    uuid references identity.users (id) on delete set null,
  decided_at    timestamptz,
  created_at    timestamptz not null default now(),
  constraint merchant_signups_name_not_blank check (btrim(name) <> ''),
  constraint merchant_signups_email_format check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  constraint merchant_signups_status_check check (status in ('pending', 'approved', 'rejected')),
  constraint merchant_signups_decided check ((status = 'pending') = (decided_at is null))
);

create unique index merchant_signups_pending_email_key
  on identity.merchant_signups (lower(email)) where status = 'pending';
create index merchant_signups_status_idx on identity.merchant_signups (status, created_at desc);

alter table identity.merchant_signups enable row level security;

comment on column identity.merchant_signups.password_hash is
  'argon2id da senha escolhida no cadastro (vira a senha do usuário ao aprovar).';

/* Permissões ------------------------------------------------------------- */

update identity.roles
set permissions = array(
  select distinct p from unnest(
    permissions || array['qr_codes.generate', 'club.manage', 'reports.view', 'merchants.approve']) p
  order by p)
where is_system;

-- Quem já gerenciava desafios continua gerando QR, cuidando do Clube e vendo relatórios.
update identity.roles
set permissions = array(
  select distinct p from unnest(
    permissions || array['qr_codes.generate', 'club.manage', 'reports.view']) p
  order by p)
where not is_system and 'challenges.manage' = any (permissions);

-- Lojista: gera QR Code só dos desafios da própria loja (a API confere a loja).
update identity.roles
set permissions = array(
  select distinct p from unnest(permissions || array['qr_codes.generate']) p order by p)
where not is_system and name = 'Lojista';

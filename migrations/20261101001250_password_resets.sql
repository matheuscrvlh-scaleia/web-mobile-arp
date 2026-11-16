-- Recuperação de senha do app do visitante: código de 6 dígitos enviado por
-- e-mail e digitado no app. Só o HMAC do código fica no banco; um pedido novo
-- apaga os códigos anteriores do visitante (só o último vale).

create table visitors.password_resets (
  id          uuid primary key default public.uuid_generate_v7(),
  visitor_id  uuid not null references visitors.visitors (id) on delete cascade,
  code_hash   text not null,
  expires_at  timestamptz not null,
  attempts    integer not null default 0,
  used_at     timestamptz,
  created_at  timestamptz not null default now(),
  constraint password_resets_code_hash_format check (code_hash ~ '^[0-9a-f]{64}$'),
  constraint password_resets_attempts_check check (attempts >= 0)
);

comment on table visitors.password_resets is
  'Códigos de recuperação de senha do app (validade curta, 5 tentativas). Limpeza por job.';
comment on column visitors.password_resets.code_hash is
  'HMAC-SHA256 (hex) de "<visitor_id>:<código>" com segredo da API. O código em si nunca é gravado.';
comment on column visitors.password_resets.attempts is 'Tentativas erradas; na 5ª o código deixa de valer.';
comment on column visitors.password_resets.used_at is 'Quando o código trocou a senha (não vale de novo).';

alter table visitors.password_resets enable row level security;

-- Último código do visitante (reset), troca por pedido novo e cascade do visitante.
create index password_resets_visitor_id_idx on visitors.password_resets (visitor_id, created_at desc);
-- Job de limpeza de vencidos.
create index password_resets_expires_at_idx on visitors.password_resets (expires_at);

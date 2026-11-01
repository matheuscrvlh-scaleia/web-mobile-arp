-- Base: extensões e funções utilitárias usadas por todos os schemas.
-- Roda igual no Supabase (onde o schema "extensions" já existe) e num Postgres
-- local/PGlite (onde é criado aqui).

create schema if not exists extensions;

-- Busca sem acento e por trecho (ILIKE '%x%' com índice GIN).
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- unaccent() é STABLE (depende do dicionário), então não pode ir em índice.
-- Esta versão fixa o dicionário pelo nome qualificado e pode ser IMMUTABLE.
-- Use SEMPRE a mesma expressão do índice: public.f_unaccent(lower(coluna)).
create or replace function public.f_unaccent(text)
returns text
language sql
immutable
strict
parallel safe
as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, $1)
$$;

comment on function public.f_unaccent(text) is
  'unaccent imutável (dicionário fixo) para índices de busca: gin (public.f_unaccent(lower(col)) extensions.gin_trgm_ops).';

-- UUID v7 (RFC 9562): 48 bits de timestamp em ms + aleatório. Ordenado no
-- tempo, então o índice da PK cresce no fim (menos page split que v4).
-- O Postgres do Supabase ainda não tem uuidv7() nativo (só no PG 18).
create or replace function public.uuid_generate_v7()
returns uuid
language plpgsql
volatile
parallel safe
as $$
declare
  ts_ms bytea;
  bytes bytea;
begin
  ts_ms := substring(int8send(floor(extract(epoch from clock_timestamp()) * 1000)::bigint) from 3);
  -- gen_random_uuid() já traz a variante RFC; trocamos os 6 primeiros bytes
  -- pelo timestamp e o nibble de versão por 7.
  bytes := uuid_send(gen_random_uuid());
  bytes := overlay(bytes placing ts_ms from 1 for 6);
  bytes := set_byte(bytes, 6, (b'0111' || get_byte(bytes, 6)::bit(4))::bit(8)::int);
  return encode(bytes, 'hex')::uuid;
end
$$;

comment on function public.uuid_generate_v7() is
  'UUID v7 ordenado no tempo; default das PKs. Trocar por uuidv7() nativo quando o Supabase estiver no PG 18.';

-- Mantém updated_at sem depender da aplicação lembrar.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

comment on function public.set_updated_at() is
  'Trigger BEFORE UPDATE: grava now() em updated_at. Ligado com WHEN (old.* is distinct from new.*) para não mexer em update sem mudança.';

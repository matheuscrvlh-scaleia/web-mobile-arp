-- Segurança no Supabase. Só a API (role dona das tabelas) lê e grava; nossos
-- schemas não são expostos pelo PostgREST. Mesmo assim, se alguém expuser um
-- schema por engano, anon/authenticated não enxergam nada:
--   1. RLS ligado em todas as tabelas, SEM políticas (nega tudo para quem não
--      é dono nem tem BYPASSRLS);
--   2. nenhum privilégio para anon/authenticated (nem nas tabelas futuras).
-- As roles anon/authenticated só existem no Supabase; no Postgres local e no
-- PGlite os blocos abaixo simplesmente não revogam nada.
--
-- Tabela nova em migration futura: inclua "enable row level security" nela
-- (os default privileges abaixo já cuidam dos grants).

do $$
declare
  t record;
begin
  for t in
    select n.nspname as schema_name, c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where c.relkind in ('r', 'p')
      and n.nspname in ('identity', 'directory', 'visitors', 'promotions', 'agenda',
                        'gamification', 'marketing', 'platform', 'audit')
  loop
    execute format('alter table %I.%I enable row level security', t.schema_name, t.table_name);
  end loop;
end
$$;

do $$
declare
  s text;
  r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if not exists (select 1 from pg_roles where rolname = r) then
      continue;
    end if;

    foreach s in array array['identity', 'directory', 'visitors', 'promotions', 'agenda',
                             'gamification', 'marketing', 'platform', 'audit'] loop
      execute format('revoke all on all tables in schema %I from %I', s, r);
      execute format('revoke all on all sequences in schema %I from %I', s, r);
      execute format('revoke all on all functions in schema %I from %I', s, r);
      execute format('revoke usage, create on schema %I from %I', s, r);
      -- Tabelas criadas depois por esta mesma role também nascem sem acesso.
      execute format('alter default privileges in schema %I revoke all on tables from %I', s, r);
      execute format('alter default privileges in schema %I revoke all on sequences from %I', s, r);
      execute format('alter default privileges in schema %I revoke all on functions from %I', s, r);
    end loop;

    -- Nossas funções no schema public (o resto do public é do Supabase).
    execute format('revoke all on function public.f_unaccent(text) from %I', r);
    execute format('revoke all on function public.uuid_generate_v7() from %I', r);
    execute format('revoke all on function public.set_updated_at() from %I', r);
  end loop;
end
$$;

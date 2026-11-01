-- Escala: métricas diárias dos destaques (sem regravar o destaque a cada
-- exibição), store opcional de rate limit no próprio Postgres e índices de
-- paginação estável (ordenação + desempate por id, e keyset).
--
-- Volumes de referência medidos com EXPLAIN (ANALYZE, BUFFERS): 500 mil
-- coupon_claims, 500 mil audit_logs, 100 mil visitantes, 50 mil qr_scans,
-- 20 mil lojas e eventos (ver docs/escalabilidade.md).
--
-- Os CREATE INDEX abaixo travam escrita na tabela enquanto rodam (a migration
-- corre numa transação). Com o volume atual é coisa de segundos; se a tabela
-- já estiver grande no deploy, crie o índice antes com CREATE INDEX
-- CONCURRENTLY (mesmo nome) — o "if not exists" daqui passa a ser no-op.

/* Métricas diárias dos destaques ----------------------------------------- */

-- Antes: cada exibição fazia UPDATE em marketing.highlights (nova versão da
-- linha, WAL, trigger de updated_at e fila no lock da linha mais lida do app).
-- Agora a API acumula as contagens em memória e grava um upsert por
-- destaque/dia a cada poucos segundos, por réplica.
create table marketing.highlight_daily_metrics (
  highlight_id uuid not null references marketing.highlights (id) on delete cascade,
  day          date not null,
  impressions  bigint not null default 0,
  clicks       bigint not null default 0,
  updated_at   timestamptz not null default now(),
  constraint highlight_daily_metrics_pkey primary key (highlight_id, day),
  constraint highlight_daily_metrics_non_negative check (impressions >= 0 and clicks >= 0)
);

comment on table marketing.highlight_daily_metrics is
  'Exibições e cliques por destaque e dia (America/Sao_Paulo). Upsert em lote pela API; total = soma dos dias.';

alter table marketing.highlight_daily_metrics enable row level security;

-- Totais antigos viram um dia só (o da última alteração do destaque).
insert into marketing.highlight_daily_metrics (highlight_id, day, impressions, clicks)
select id, (updated_at at time zone 'America/Sao_Paulo')::date, impressions, clicks
from marketing.highlights
where impressions > 0 or clicks > 0;

comment on column marketing.highlights.impressions is
  'LEGADO: não é mais incrementado (ver highlight_daily_metrics). Remover numa migration futura.';
comment on column marketing.highlights.clicks is
  'LEGADO: não é mais incrementado (ver highlight_daily_metrics). Remover numa migration futura.';

/* Rate limit distribuído (opcional: RATE_LIMIT_STORE=postgres) ----------- */

-- UNLOGGED: sem WAL (escrita barata); some num crash do banco, o que para
-- contador de rate limit é aceitável. Só as rotas sensíveis usam.
create unlogged table platform.rate_limit_hits (
  key      text primary key,
  hits     integer not null,
  reset_at timestamptz not null
);

comment on table platform.rate_limit_hits is
  'Janelas de rate limit compartilhadas entre réplicas (login, cadastro, pegar cupom, ler QR). Limpeza por job.';

alter table platform.rate_limit_hits enable row level security;

create index rate_limit_hits_reset_at_idx on platform.rate_limit_hits (reset_at);

/* Paginação estável e keyset --------------------------------------------- */

-- Cupons pegos (painel): order by claimed_at desc, id desc e keyset
-- (claimed_at, id) < ($1, $2). Substitui o índice só de claimed_at (que
-- continua servindo aos intervalos do dashboard como prefixo).
create index if not exists coupon_claims_claimed_at_id_idx
  on promotions.coupon_claims (claimed_at, id);
drop index if exists promotions.coupon_claims_claimed_at_idx;

-- Auditoria: order by created_at desc, id desc e keyset.
create index if not exists audit_logs_created_at_id_idx
  on audit.audit_logs (created_at desc, id desc);
drop index if exists audit.audit_logs_created_at_idx;

-- Visitantes (painel): order by created_at desc, id desc.
create index if not exists visitors_created_at_id_idx
  on visitors.visitors (created_at, id);
drop index if exists visitors.visitors_created_at_idx;

-- Leituras de QR no dashboard: contagem por resultado no período sem ir à tabela.
create index if not exists qr_scans_scanned_at_result_idx
  on gamification.qr_scans (scanned_at) include (result);
drop index if exists gamification.qr_scans_scanned_at_idx;

-- Selos conquistados (painel): order by earned_at desc, id desc.
create index if not exists earned_seals_earned_at_id_idx
  on gamification.earned_seals (earned_at, id);
drop index if exists gamification.earned_seals_earned_at_idx;

/* Sessões rotacionadas ---------------------------------------------------- */

-- Cada refresh do app grava uma sessão nova; o job apaga as rotacionadas com
-- mais de 7 dias (antes elas ficavam até vencer, 90 dias por aparelho).
create index if not exists sessions_rotated_created_idx
  on identity.sessions (created_at)
  where replaced_by_id is not null;

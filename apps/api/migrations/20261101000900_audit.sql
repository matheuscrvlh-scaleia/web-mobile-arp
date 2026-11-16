-- audit: histórico de alterações do painel (e ações relevantes do app).
-- Gravado pela API na MESMA transação da escrita (porta AuditLogger).

create schema if not exists audit;

comment on schema audit is 'Histórico de alterações (somente inserção).';

create table audit.audit_logs (
  id          bigint generated always as identity primary key,
  actor_type  text not null,
  actor_id    uuid,
  actor_name  text,
  action      text not null,
  entity_type text not null,
  entity_id   text,
  changes     jsonb,
  ip          inet,
  user_agent  text,
  request_id  text,
  created_at  timestamptz not null default now(),
  constraint audit_logs_actor_type_check check (actor_type in ('staff', 'visitor', 'system')),
  constraint audit_logs_actor_check check (actor_type = 'system' or actor_id is not null),
  constraint audit_logs_action_format check (action ~ '^[a-z][a-z_]*\.[a-z][a-z_]*$')
);

comment on table audit.audit_logs is
  'Só cresce (trigger bloqueia update/delete). Candidata a particionamento mensal por created_at quando crescer.';
comment on column audit.audit_logs.id is 'bigint (identity) — serializado como string na API.';
comment on column audit.audit_logs.actor_name is 'Nome do ator no momento da ação (o histórico não muda se o usuário for renomeado).';
comment on column audit.audit_logs.action is '<entidade>.<ação>, ex.: coupon.create, claim.redeem, visitor.block.';
comment on column audit.audit_logs.entity_id is 'texto: uuid na maioria, mas pode ser a chave de uma configuração.';
comment on column audit.audit_logs.changes is '{ campo: { from, to } } nas edições; snapshot nas criações.';
comment on column audit.audit_logs.request_id is 'Id da requisição HTTP, para cruzar com os logs da API.';

-- Histórico de uma entidade (aba "Histórico" do detalhe).
create index audit_logs_entity_idx on audit.audit_logs (entity_type, entity_id, created_at desc);
-- O que um usuário fez.
create index audit_logs_actor_idx on audit.audit_logs (actor_id, created_at desc) where actor_id is not null;
-- Listagem geral (mais recentes primeiro) e filtro por período.
create index audit_logs_created_at_idx on audit.audit_logs (created_at desc);
-- Filtro por ação.
create index audit_logs_action_idx on audit.audit_logs (action, created_at desc);

-- Auditoria que pode ser editada não serve como auditoria.
create or replace function audit.prevent_audit_log_changes()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit.audit_logs é somente inserção (% bloqueado)', tg_op
    using errcode = 'insufficient_privilege';
end
$$;

create trigger audit_logs_append_only
  before update or delete on audit.audit_logs
  for each row execute function audit.prevent_audit_log_changes();

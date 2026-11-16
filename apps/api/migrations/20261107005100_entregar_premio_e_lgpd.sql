/*
 * Redesign (GERAL):
 *
 * - Permissão nova club.redeem ("Trocar pontos no balcão"), separada de
 *   club.manage: o balcão troca pontos por prêmio (e desfaz a troca) sem
 *   poder mexer na lojinha. Quem já gerencia o Clube (e o cargo do sistema)
 *   continua podendo entregar: recebe a permissão nova aqui. Daqui em diante
 *   a API acrescenta club.redeem sozinha a todo cargo com club.manage.
 * - LGPD: visitante anonimizado (nome, e-mail, telefone, foto e apelido
 *   apagados a pedido do titular). anonymized_at marca a linha; os números
 *   agregados (cupons, selos, trocas) continuam.
 */

update identity.roles
set permissions = array(
  select distinct p from unnest(permissions || array['club.redeem']) p order by p)
where is_system or 'club.manage' = any (permissions);

alter table visitors.visitors add column anonymized_at timestamptz;

comment on column visitors.visitors.anonymized_at is
  'Quando os dados pessoais foram apagados (LGPD). A conta fica bloqueada e não volta.';

/*
 * O histórico continua só de inserção, com UMA exceção: a anonimização (LGPD)
 * apaga, na mesma transação e com a marca arp.lgpd_erase ligada, o nome, o IP,
 * o navegador e os campos das linhas do próprio visitante. Quem fez, o quê e
 * quando não mudam.
 */
create or replace function audit.prevent_audit_log_changes()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE'
     and current_setting('arp.lgpd_erase', true) = 'on'
     and (new.id, new.actor_type, new.actor_id, new.action, new.entity_type, new.entity_id,
          new.request_id, new.created_at)
         is not distinct from
         (old.id, old.actor_type, old.actor_id, old.action, old.entity_type, old.entity_id,
          old.request_id, old.created_at) then
    return new;
  end if;
  raise exception 'audit.audit_logs é somente inserção (% bloqueado)', tg_op
    using errcode = 'insufficient_privilege';
end
$$;

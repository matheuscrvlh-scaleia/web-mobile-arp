/*
 * Fase 2: dias da semana do cupom e revisão da ARP.
 *
 * - weekdays: dias em que o cupom pode ser usado (0 = domingo). Fora deles,
 *   a validação no caixa recusa ("Recusado: este cupom só vale seg, ter…").
 * - review: o cupom criado ou editado pelo lojista fica 'pending' até a ARP
 *   aprovar; só 'approved' aparece no app. Os cupons que já existem ficam
 *   aprovados (foram criados pela equipe).
 */

alter table promotions.coupons
  add column weekdays smallint[] not null default '{0,1,2,3,4,5,6}',
  add column review text not null default 'approved',
  add column review_note text;

alter table promotions.coupons
  add constraint coupons_weekdays_check check (
    cardinality(weekdays) between 1 and 7 and weekdays <@ '{0,1,2,3,4,5,6}'::smallint[]),
  add constraint coupons_review_check check (review in ('pending', 'approved', 'rejected'));

comment on column promotions.coupons.weekdays is
  'Dias em que o cupom pode ser usado (0 = domingo … 6 = sábado), no fuso America/Sao_Paulo.';
comment on column promotions.coupons.review is
  'Revisão da ARP: pending (aguardando), approved (vai ao app) ou rejected (review_note diz o motivo).';

-- Fila de revisão do painel.
create index coupons_review_pending_idx on promotions.coupons (created_at desc)
  where review = 'pending';

-- O cargo do sistema (Administrador) recebe a permissão nova.
update identity.roles
set permissions = array(
  select distinct p from unnest(permissions || array['coupons.approve']) p order by p)
where is_system;

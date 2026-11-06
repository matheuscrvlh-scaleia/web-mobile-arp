/*
 * Clube ARP: a troca passa a ser só no balcão.
 *
 * O app não pede mais prêmio (pedido com código para retirar depois deixava a
 * ARP presa a um estoque que podia acabar). Agora a equipe do Centro de
 * Informações acha o visitante, confere os pontos, escolhe o prêmio e troca:
 * a troca já sai entregue. Errou? Cancela, e pontos e estoque voltam.
 *
 * Pedidos que estavam esperando retirada são cancelados: os pontos voltam
 * para o visitante e a unidade volta para o estoque.
 */

alter table gamification.prize_redemptions
  add column cancelled_at timestamptz,
  add column cancelled_by uuid references identity.users (id) on delete set null;

update gamification.prizes p
set stock = p.stock + x.n
from (
  select prize_id, count(*)::int as n
  from gamification.prize_redemptions
  where status = 'pending'
  group by prize_id
) x
where x.prize_id = p.id;

update gamification.prize_redemptions
set status = 'cancelled', cancelled_at = now()
where status in ('pending', 'cancelled');

alter table gamification.prize_redemptions
  alter column status set default 'delivered',
  drop constraint prize_redemptions_status_check,
  add constraint prize_redemptions_status_check check (status in ('delivered', 'cancelled')),
  add constraint prize_redemptions_cancelled_pair check ((status = 'cancelled') = (cancelled_at is not null));

comment on table gamification.prize_redemptions is
  'Trocas da lojinha, feitas no balcão do Centro de Informações (já entregues). Desconta os pontos (soma das trocas não canceladas) e baixa o estoque; cancelar devolve os dois.';
comment on column gamification.prize_redemptions.code is 'Comprovante da troca.';
comment on column gamification.prize_redemptions.delivered_by is 'Quem fez a troca no balcão.';

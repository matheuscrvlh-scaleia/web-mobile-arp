/*
 * Desafio automático com gatilho.
 *
 * auto_trigger: o que dá o selo num desafio automático.
 *   coupon_redeemed = a loja dá baixa (valida no caixa) no cupom de coupon_id;
 *   integration     = um sistema externo avisa (ex.: estacionamento pago pelo app).
 * coupon_id: cupom que vale o selo (só no gatilho coupon_redeemed). Restrict:
 * o cupom não some enquanto um desafio depende dele.
 */

alter table gamification.challenges
  add column auto_trigger text,
  add column coupon_id uuid references promotions.coupons (id) on delete restrict;

-- Automáticos que já existiam eram por integração.
update gamification.challenges set auto_trigger = 'integration' where validation = 'auto';

alter table gamification.challenges
  add constraint challenges_auto_trigger_check
    check (auto_trigger in ('coupon_redeemed', 'integration')),
  -- Só o automático tem gatilho, e todo automático tem um.
  add constraint challenges_auto_trigger_required
    check ((validation = 'auto') = (auto_trigger is not null)),
  -- Cupom só (e sempre) no gatilho "loja deu baixa no cupom".
  add constraint challenges_coupon_trigger
    check ((auto_trigger is not distinct from 'coupon_redeemed') = (coupon_id is not null));

comment on column gamification.challenges.auto_trigger is
  'Desafio automático: coupon_redeemed = baixa do cupom coupon_id no caixa; integration = sistema externo.';
comment on column gamification.challenges.coupon_id is
  'Cupom cuja baixa dá o selo (gatilho coupon_redeemed).';

-- Baixa no caixa: acha os desafios do cupom.
create index challenges_coupon_id_idx on gamification.challenges (coupon_id)
  where coupon_id is not null;

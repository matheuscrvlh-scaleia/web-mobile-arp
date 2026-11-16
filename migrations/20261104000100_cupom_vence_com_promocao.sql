/*
 * Cupom pego que vence junto com a promoção.
 *
 * expires_with_promotion: marcado, o pego não vale depois de ends_at, mesmo
 * dentro das horas para usar (o caixa recusa como vencido). Desmarcado (o
 * padrão, e como já era), quem pegou tem as horas inteiras, mesmo depois do fim.
 */

alter table promotions.coupons
  add column expires_with_promotion boolean not null default false;

comment on column promotions.coupons.expires_with_promotion is
  'Se true, o pego vence em ends_at mesmo antes de redeem_window_hours (sem ends_at, não muda nada).';

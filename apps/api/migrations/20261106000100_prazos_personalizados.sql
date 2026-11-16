/*
 * Prazos personalizados.
 *
 * Cupom, use_until: data fixa em que o pego vence, no lugar das horas para
 * usar (redeem_window_hours fica guardado, mas não conta). Vazio, vale como
 * era: as horas a partir de quando pegou. Depois dela, ninguém pega mais.
 *
 * Desafio e selo, available_from/available_until: janela em que dão selo
 * (QR e automático). Vazio, vale a campanha. A campanha continua mandando:
 * a janela só estreita.
 */

alter table promotions.coupons
  add column use_until timestamptz,
  add constraint coupons_use_until_after_start check (use_until is null or use_until > starts_at);

comment on column promotions.coupons.use_until is
  'Data fixa em que o pego vence (ignora redeem_window_hours). Null = horas para usar.';

alter table gamification.challenges
  add column available_from timestamptz,
  add column available_until timestamptz,
  add constraint challenges_available_period check (
    available_from is null or available_until is null or available_until > available_from
  );

alter table gamification.seals
  add column available_from timestamptz,
  add column available_until timestamptz,
  add constraint seals_available_period check (
    available_from is null or available_until is null or available_until > available_from
  );

comment on column gamification.challenges.available_from is 'Começa a dar selo (null = início da campanha).';
comment on column gamification.challenges.available_until is 'Para de dar selo (null = fim da campanha).';
comment on column gamification.seals.available_from is 'Começa a ser dado (null = sem limite).';
comment on column gamification.seals.available_until is 'Para de ser dado (null = sem limite).';

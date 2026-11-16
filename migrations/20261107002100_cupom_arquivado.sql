/*
 * Cupom arquivado.
 *
 * archived_at: a promoção sai das listas padrão do painel (fica no filtro
 * "Arquivadas") e o histórico continua. Só arquiva o que não está no ar
 * (rascunho, pausada ou encerrada), então o app não muda. Desarquivar limpa a
 * data e a promoção volta com o status que tinha (nunca direto para o ar).
 */

alter table promotions.coupons add column archived_at timestamptz;

comment on column promotions.coupons.archived_at is
  'Arquivada em (null = aparece nas listas padrão). Só fora do ar.';

/*
 * Comunicação: ciclo de vida que o painel pedia (arquivar, pausar destaque) e
 * evento semanal em vários dias.
 *
 * - agenda.events.archived_at: arquivado sai das listas e do calendário do
 *   painel. Arquivar um publicado o pausa antes (nunca fica "no app" e
 *   arquivado ao mesmo tempo), então o app não muda.
 * - agenda.events.weekdays: "toda terça e quinta". `weekday` continua (primeiro
 *   dia da lista) para o app que ainda lê o campo antigo.
 * - marketing.highlights.status ganha 'paused' ("No ar" desligado): sai do
 *   carrossel mas continua na ordem; 'archived' sai da ordem.
 */

alter table agenda.events add column archived_at timestamptz;
comment on column agenda.events.archived_at is
  'Arquivado: fora das listas padrão e do calendário do painel. Nunca com status published.';
create index events_archived_at_idx on agenda.events (archived_at) where archived_at is not null;

alter table agenda.events add column weekdays smallint[];
update agenda.events set weekdays = array[weekday] where weekday is not null;
alter table agenda.events
  add constraint events_weekdays_check check (
    weekdays is null
    or (cardinality(weekdays) between 1 and 7 and weekdays <@ '{0,1,2,3,4,5,6}'::smallint[])
  ),
  -- weekday = primeiro de weekdays (compatibilidade do app).
  add constraint events_weekdays_match check (
    (weekdays is null and weekday is null)
    or (weekday is not null and weekdays is not null and weekday = weekdays[1])
  );
comment on column agenda.events.weekdays is
  'weekly: dias da semana (0 = domingo … 6 = sábado), em ordem. weekday = weekdays[1].';

alter table marketing.highlights drop constraint highlights_status_check;
alter table marketing.highlights add constraint highlights_status_check
  check (status in ('draft', 'published', 'paused', 'archived'));

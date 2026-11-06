/*
 * Push para quem marcou interesse num evento (aviso de adiado/cancelado).
 *
 * - audience 'event_interested' + event_id: o público é agenda.event_interests
 *   do evento. É aviso de serviço: vale mesmo para quem não aceitou ofertas.
 * - Sem FK para agenda.events: evento com interessados não se exclui, e um
 *   rascunho que aponte para evento excluído só fica com público 0 (a API
 *   recusa enviar para ninguém).
 */

alter table marketing.push_notifications add column event_id uuid;
comment on column marketing.push_notifications.event_id is
  'Evento do público event_interested (quem marcou interesse).';

alter table marketing.push_notifications
  drop constraint push_notifications_audience_check,
  add constraint push_notifications_audience_check
    check (audience in ('all', 'opted_in', 'store_followers', 'event_interested')),
  add constraint push_notifications_event_required
    check (audience <> 'event_interested' or event_id is not null);

create index push_notifications_event_id_idx on marketing.push_notifications (event_id)
  where event_id is not null;

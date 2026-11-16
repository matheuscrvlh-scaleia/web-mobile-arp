/*
 * Eventos fictícios de demonstração (seed/demo.ts), como os demais is_demo.
 * Com DEMO_DATA_IN_APP=true (padrão) o app mostra os fictícios para a
 * demonstração; false esconde tudo o que é fictício do app.
 */

alter table agenda.events add column is_demo boolean not null default false;

comment on column agenda.events.is_demo is 'Evento fictício de demonstração (painel mostra o ícone; app só com DEMO_DATA_IN_APP).';

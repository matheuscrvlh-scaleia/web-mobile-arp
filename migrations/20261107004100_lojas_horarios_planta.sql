/*
 * Lojas e mapa (redesign de usabilidade):
 *
 * - Horários: mais de um intervalo por dia (restaurante 11–15h e 18–23h).
 *   A chave passa a ser (loja, dia, abertura); a API recusa intervalos que
 *   se cruzam e limita a 3 por dia.
 * - Andares: imagem da planta de fundo, só no painel, para desenhar o mapa
 *   por cima (o app continua vendo só o desenho).
 */

alter table directory.store_hours drop constraint store_hours_pkey;
alter table directory.store_hours
  add constraint store_hours_pkey primary key (store_id, weekday, opens_at);

comment on table directory.store_hours is
  'Intervalos de funcionamento por dia da semana (até 3 por dia, sem se cruzar). Dia sem linha = fechado. A API substitui todas as linhas da loja ao editar.';

alter table directory.floors add column background_url text;

comment on column directory.floors.background_url is
  'Planta do andar (imagem) de fundo no editor do mapa do painel. O app não usa.';

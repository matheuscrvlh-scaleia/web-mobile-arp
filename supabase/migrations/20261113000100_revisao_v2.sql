-- Revisão V2 (doc de 13/11): Trevos por selo, validade dos Trevos escolhida
-- pela ARP e "Seja um Amigo do Sustentarp" fora por enquanto.

/* Trevos de cada selo ---------------------------------------------------- */

-- O selo é a conquista de um desafio (ex.: Descarte de cápsulas = +10, Ciclo
-- do Vidro = +15, os dois na categoria Transforma). gamification.seals passa a
-- ser a categoria; seals.points vira o padrão da categoria.
alter table gamification.challenges
  add column points integer,
  add constraint challenges_points_range check (points is null or points between 1 and 1000);

comment on column gamification.challenges.points is
  'Trevos que o selo deste desafio dá. null = os padrão da categoria (seals.points).';
comment on column gamification.seals.points is
  'Trevos padrão da categoria, quando o desafio não define os seus.';

/* Validade dos Trevos ---------------------------------------------------- */

-- Sai "meses de validade" (nunca usado). A validade agora é uma data escolhida
-- na gestão (trevosValidUntil) e o início do período (trevosCountFrom).
delete from platform.settings where key = 'pointsValidityMonths';

/* Amigo do Sustentarp ---------------------------------------------------- */

-- A ARP ainda vai decidir com a Letícia se o botão entra e onde.
delete from content.pages where key = 'sustentarp_friend';

alter table content.pages
  drop constraint pages_key_check,
  add constraint pages_key_check check (key in (
    'history', 'rules', 'club_rules', 'circuit', 'history_full', 'sustentarp'
  ));

comment on table content.pages is
  'Textos editáveis. history = Nossa história (boas-vindas); history_full = Nossa história completa (Saiba mais; file_url = foto); rules = Regras da ARP (file_url = PDF); club_rules = Regulamento do Clube ARP; circuit = abertura do Circuito Cultural (file_url = imagem do mapa); sustentarp = abertura do Sustentarp (file_url = foto do topo). Sem linha = texto ainda não escrito.';

/* RD Station ------------------------------------------------------------- */

-- Quem marcou "Quero receber novidades e ofertas" vai para o RD. A ligação fica
-- pronta e desligada (RD_STATION_ENABLED) até a ARP definir o funil e a etapa.
alter table visitors.visitors add column rd_sent_at timestamptz;

comment on column visitors.visitors.rd_sent_at is
  'Quando o contato foi enviado ao RD Station (null = ainda não; só vai quem tem marketing_opt_in).';

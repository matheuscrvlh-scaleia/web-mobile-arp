/*
 * Correções V2 do app (PDF "mockup_app_CorrecoesV2"):
 *
 * - Agenda: evento em mais de um período (ex.: 10 a 12 e 17 a 19/10) e link
 *   para comprar ou retirar ingresso.
 * - Clube ARP: selos não vencem mais (viram histórico) e os pontos passam a
 *   se chamar Trevos, que valem até 31/12 do ano em que foram ganhos (a conta
 *   fica na API, em club-points.ts). A troca volta a começar no app: o
 *   visitante troca, recebe um código e retira no Mercado Local, que valida e
 *   entrega. Enquanto espera, os Trevos e a unidade ficam reservados; se não
 *   retirar no prazo, a troca é cancelada e os dois voltam.
 * - Prêmio ganha "como retirar".
 * - Categorias de selo: entra Estilo; Origens sai da vitrine (quem já ganhou
 *   continua vendo no histórico).
 * - Textos novos: Nossa história completa, abertura do Sustentarp e Seja um
 *   Amigo do Sustentarp.
 * - NPS dentro do app.
 */

/* Agenda ----------------------------------------------------------------- */

alter table agenda.events
  add column periods jsonb,
  add column ticket_url text,
  add constraint events_periods_only_range check (periods is null or recurrence = 'range'),
  add constraint events_periods_shape check (
    periods is null or (jsonb_typeof(periods) = 'array' and jsonb_array_length(periods) between 2 and 20)
  ),
  add constraint events_ticket_url_format check (ticket_url is null or ticket_url ~ '^https?://');

comment on column agenda.events.periods is
  'range em 2+ períodos: [{"startsOn","endsOn"}] em ordem, sem sobrepor. starts_on/ends_on = primeiro e último dia (o GiST continua achando). null = de starts_on a ends_on direto.';
comment on column agenda.events.ticket_url is 'Link para comprar ou retirar ingresso (null = sem venda).';

/* Lojinha: troca pelo app com código ------------------------------------- */

alter table gamification.prizes add column pickup_rules text not null default '';
comment on column gamification.prizes.pickup_rules is 'Como e onde retirar (vazio = texto padrão do app).';

alter table gamification.prize_redemptions
  add column expires_at timestamptz,
  alter column delivered_at drop not null,
  drop constraint prize_redemptions_status_check,
  add constraint prize_redemptions_status_check check (status in ('pending', 'delivered', 'cancelled')),
  add constraint prize_redemptions_pending_expires check (status <> 'pending' or expires_at is not null);

create index prize_redemptions_pending_idx on gamification.prize_redemptions (expires_at)
  where status = 'pending';

comment on table gamification.prize_redemptions is
  'Trocas da lojinha. pending = feita no app, esperando retirada no Mercado Local (Trevos e unidade reservados até expires_at). delivered = entregue (no balcão já nasce assim). cancelled = desfeita ou vencida: Trevos e estoque voltam.';
comment on column gamification.prize_redemptions.code is 'Código da troca (o visitante mostra no Mercado Local).';
comment on column gamification.prize_redemptions.expires_at is 'pending: até quando dá para retirar.';
comment on column gamification.prize_redemptions.delivered_by is 'Quem entregou (balcão ou Mercado Local).';

/* Selos: não vencem mais --------------------------------------------------- */

comment on column gamification.seals.validity_months is 'Legado: selos não vencem mais (Trevos valem até 31/12 do ano).';
comment on column gamification.earned_seals.expires_at is 'Legado: selos não vencem mais; os Trevos valem até 31/12 do ano em que foram ganhos.';

-- Categoria nova. Origens sai da vitrine do app (status archived), mas quem já
-- conquistou continua vendo no histórico.
insert into gamification.seals
  (slug, name, description, icon, gradient_from, gradient_to, sort_order, status, points, repeatable)
values
  ('estilo', 'Estilo', 'Comprou numa loja parceira de moda e acessórios.', 'shirt', '#f5a3c0', '#b4466f', 7,
   'active', 10, false)
on conflict (slug) do nothing;

update gamification.seals set status = 'archived'
where slug = 'explorador' and name = 'Origens';

/* Textos novos ----------------------------------------------------------- */

alter table content.pages
  drop constraint pages_key_check,
  add constraint pages_key_check check (key in (
    'history', 'rules', 'club_rules', 'circuit', 'history_full', 'sustentarp', 'sustentarp_friend'
  ));

comment on table content.pages is
  'Textos editáveis. history = Nossa história (boas-vindas); history_full = Nossa história completa (Saiba mais; file_url = foto); rules = Regras da ARP (file_url = PDF); club_rules = Regulamento do Clube ARP; circuit = abertura do Circuito Cultural (file_url = imagem do mapa); sustentarp = abertura do Sustentarp (file_url = foto do topo); sustentarp_friend = Seja um Amigo do Sustentarp (file_url = formulário ou PDF). Sem linha = texto ainda não escrito.';

/* NPS -------------------------------------------------------------------- */

create table visitors.nps_responses (
  id          uuid primary key default public.uuid_generate_v7(),
  visitor_id  uuid references visitors.visitors (id) on delete set null,
  score       smallint not null,
  comment     text,
  platform    text,
  app_version text,
  created_at  timestamptz not null default now(),
  constraint nps_responses_score_range check (score between 0 and 10),
  constraint nps_responses_comment_length check (comment is null or char_length(comment) <= 500)
);

create index nps_responses_created_idx on visitors.nps_responses (created_at desc);
create index nps_responses_visitor_idx on visitors.nps_responses (visitor_id, created_at desc);

alter table visitors.nps_responses enable row level security;

comment on table visitors.nps_responses is
  'NPS do app: "De 0 a 10, quanto você recomendaria a ARP?". 9–10 promotor, 7–8 neutro, 0–6 detrator.';

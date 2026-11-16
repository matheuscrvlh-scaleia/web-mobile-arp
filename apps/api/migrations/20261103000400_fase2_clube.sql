/*
 * Fase 2: Clube ARP.
 *
 * - Selo vale pontos, vence depois de validity_months e pode ser repetível.
 * - Selo ganho guarda os pontos e a validade do momento em que foi ganho.
 *   Selo de uso único sai uma vez por pessoa (mesmo vencido); repetível sai
 *   uma vez por código (no telão, uma vez por janela do código).
 * - QR Code sempre tem prazo (ttl_seconds). rotating = modo telão: o código
 *   muda a cada ttl_seconds e o anterior deixa de valer.
 * - Lojinha: prêmios com estoque e trocas com código de retirada.
 * - Ranking: só quem aceitou, só com apelido.
 */

/* Selos ------------------------------------------------------------------ */

alter table gamification.seals
  add column points integer not null default 10,
  add column validity_months integer not null default 6,
  add column repeatable boolean not null default false,
  add constraint seals_points_range check (points between 1 and 1000),
  add constraint seals_validity_range check (validity_months between 1 and 12);

comment on column gamification.seals.points is 'Pontos que o selo dá no Clube ARP.';
comment on column gamification.seals.validity_months is 'Meses até o selo ganho vencer (os pontos saem do total).';
comment on column gamification.seals.repeatable is 'Pode ser ganho de novo (ex.: evento). false = uso único.';

/* Desafios --------------------------------------------------------------- */

alter table gamification.challenges add column product text;
comment on column gamification.challenges.product is
  'Produto do parceiro (desafio de produto): o lojista da loja gera o QR e os selos entram na cobrança.';

/* QR Codes --------------------------------------------------------------- */

alter table gamification.qr_codes
  add column ttl_seconds integer,
  add column rotating boolean not null default false,
  add column rotation_secret text,
  add column created_by uuid references identity.users (id) on delete set null;

-- QR antigo sem prazo: vale 24 h a partir de agora (não existe QR sem prazo).
update gamification.qr_codes
set ttl_seconds = 86400,
    valid_until = coalesce(valid_until, now() + interval '24 hours');

alter table gamification.qr_codes
  alter column ttl_seconds set not null,
  add constraint qr_codes_ttl_range check (ttl_seconds between 15 and 604800),
  add constraint qr_codes_fixed_has_deadline check (rotating or valid_until is not null),
  add constraint qr_codes_rotating_has_secret check (not rotating or rotation_secret is not null);

comment on column gamification.qr_codes.ttl_seconds is
  'Prazo de cada código. Fixo: valid_until = criação + prazo. Telão: o código muda a cada prazo.';
comment on column gamification.qr_codes.rotating is
  'Modo telão: o texto do QR leva a janela atual assinada (HMAC); janela passada é recusada (print não serve).';

create index qr_codes_created_by_idx on gamification.qr_codes (created_by) where created_by is not null;

/* Selos ganhos ----------------------------------------------------------- */

alter table gamification.earned_seals
  add column points integer,
  add column expires_at timestamptz,
  add column repeatable boolean not null default false,
  add column qr_window bigint not null default 0;

update gamification.earned_seals es
set points = s.points,
    expires_at = es.earned_at + make_interval(months => s.validity_months)
from gamification.seals s
where s.id = es.seal_id;

alter table gamification.earned_seals
  alter column points set not null,
  alter column expires_at set not null,
  drop constraint earned_seals_visitor_challenge_key;

-- Uso único: uma vez por pessoa e desafio, para sempre.
create unique index earned_seals_once_key on gamification.earned_seals (visitor_id, challenge_id)
  where not repeatable;
-- Repetível: uma vez por código (e por janela do telão).
create unique index earned_seals_repeat_key
  on gamification.earned_seals (visitor_id, challenge_id, qr_code_id, qr_window)
  where repeatable;
-- Pontos do visitante (selos valendo).
create index earned_seals_visitor_expires_idx on gamification.earned_seals (visitor_id, expires_at);

comment on column gamification.earned_seals.points is 'Pontos do selo no momento em que foi ganho.';
comment on column gamification.earned_seals.expires_at is 'Vencido, os pontos saem do total.';

/* Lojinha ---------------------------------------------------------------- */

create table gamification.prizes (
  id          uuid primary key default public.uuid_generate_v7(),
  name        text not null,
  description text not null default '',
  kind        text not null,
  points      integer not null,
  stock       integer not null,
  image_url   text,
  active      boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint prizes_name_not_blank check (btrim(name) <> ''),
  constraint prizes_kind_check check (kind in ('souvenir', 'artist', 'partner')),
  constraint prizes_points_range check (points between 1 and 100000),
  constraint prizes_stock_range check (stock >= 0)
);

alter table gamification.prizes enable row level security;

comment on table gamification.prizes is 'Prêmios da lojinha do Clube ARP. Com estoque 0, sai da lojinha.';

create trigger prizes_set_updated_at
  before update on gamification.prizes
  for each row when (old.* is distinct from new.*)
  execute function public.set_updated_at();

create table gamification.prize_redemptions (
  id           uuid primary key default public.uuid_generate_v7(),
  prize_id     uuid not null references gamification.prizes (id),
  visitor_id   uuid not null references visitors.visitors (id),
  points       integer not null,
  code         text not null,
  status       text not null default 'pending',
  created_at   timestamptz not null default now(),
  delivered_at timestamptz,
  delivered_by uuid references identity.users (id) on delete set null,
  constraint prize_redemptions_code_key unique (code),
  constraint prize_redemptions_points_positive check (points > 0),
  constraint prize_redemptions_status_check check (status in ('pending', 'delivered', 'cancelled'))
);

create index prize_redemptions_visitor_idx on gamification.prize_redemptions (visitor_id);
create index prize_redemptions_prize_idx on gamification.prize_redemptions (prize_id);
create index prize_redemptions_created_idx on gamification.prize_redemptions (created_at desc);

alter table gamification.prize_redemptions enable row level security;

comment on table gamification.prize_redemptions is
  'Trocas na lojinha: desconta os pontos (soma das trocas não canceladas) e baixa o estoque. Retirada no Centro de Informações com o código.';

/* Ranking ---------------------------------------------------------------- */

alter table visitors.visitors
  add column ranking_nickname text,
  add column ranking_accepted_at timestamptz,
  add constraint visitors_ranking_pair check ((ranking_nickname is null) = (ranking_accepted_at is null));

create unique index visitors_ranking_nickname_key
  on visitors.visitors (lower(ranking_nickname)) where ranking_nickname is not null;

comment on column visitors.visitors.ranking_nickname is
  'Apelido no ranking do Clube ARP (null = não participa). O nome real nunca aparece no ranking.';

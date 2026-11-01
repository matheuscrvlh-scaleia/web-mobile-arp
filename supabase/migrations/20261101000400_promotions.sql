-- promotions: cupons publicados pelas lojas e os cupons pegos (claims).
--
-- Estoque NÃO é um contador gravado: restantes = total − (ativos no prazo +
-- usados), sempre derivado de coupon_claims. Assim um claim que vence sem uso
-- "devolve" a unidade sozinho, sem job e sem risco de contador dessincronizado.
-- A concorrência do "pegar" é serializada com SELECT … FOR UPDATE no cupom.

create schema if not exists promotions;

comment on schema promotions is 'Cupons com estoque e prazo, e os cupons pegos pelos visitantes.';

/* Cupons ----------------------------------------------------------------- */

create table promotions.coupons (
  id                  uuid primary key default public.uuid_generate_v7(),
  store_id            uuid not null references directory.stores (id),
  title               text not null,
  headline            text not null,
  headline_sub        text,
  description         text,
  schedule_note       text,
  starts_at           timestamptz not null,
  ends_at             timestamptz,
  total_quantity      integer not null,
  redeem_window_hours integer not null,
  tone                text not null,
  icon                text not null,
  image_url           text,
  savings_cents       integer,
  status              text not null default 'draft',
  created_by          uuid references identity.users (id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint coupons_title_not_blank check (btrim(title) <> ''),
  constraint coupons_headline_not_blank check (btrim(headline) <> ''),
  constraint coupons_total_quantity_positive check (total_quantity > 0),
  constraint coupons_redeem_window_range check (redeem_window_hours between 1 and 720),
  constraint coupons_tone_check check (tone in ('green', 'ink', 'clay', 'sand', 'deep')),
  constraint coupons_icon_format check (icon ~ '^[a-z0-9-]+$'),
  constraint coupons_savings_non_negative check (savings_cents >= 0),
  constraint coupons_status_check check (status in ('draft', 'active', 'paused', 'ended')),
  constraint coupons_period_check check (ends_at is null or ends_at > starts_at)
);

comment on column promotions.coupons.headline is 'Destaque grande do cartão (ex.: "R$ 5", "15%", "Grátis").';
comment on column promotions.coupons.schedule_note is 'Quando vale, em texto livre (ex.: "Seg a sex, 11h às 15h"). Não é regra, é informação.';
comment on column promotions.coupons.total_quantity is 'Unidades liberadas pelo lojista. Nunca se pega mais que isso ao mesmo tempo (ativos no prazo + usados).';
comment on column promotions.coupons.redeem_window_hours is 'Prazo para usar depois de pegar. expires_at do claim = claimed_at + este prazo.';
comment on column promotions.coupons.savings_cents is 'Economia estimada por uso, em centavos ("você economizou" do app e KPI do dashboard).';
comment on column promotions.coupons.created_by is 'Usuário do painel que criou. Nulo só para dados importados.';

-- Cupons da loja (página da loja, painel do lojista, activeCouponsCount).
create index coupons_store_id_status_idx on promotions.coupons (store_id, status);
-- Listagem por status e vitrine do app (ativos dentro do período).
create index coupons_status_period_idx on promotions.coupons (status, starts_at, ends_at);
create index coupons_created_by_idx on promotions.coupons (created_by) where created_by is not null;
-- Busca sem acento pelo título.
create index coupons_title_trgm_idx on promotions.coupons
  using gin (public.f_unaccent(lower(title)) extensions.gin_trgm_ops);

create trigger coupons_set_updated_at
  before update on promotions.coupons
  for each row when (old.* is distinct from new.*)
  execute function public.set_updated_at();

/* Cupons pegos ----------------------------------------------------------- */

create table promotions.coupon_claims (
  id          uuid primary key default public.uuid_generate_v7(),
  coupon_id   uuid not null references promotions.coupons (id),
  visitor_id  uuid not null references visitors.visitors (id),
  code        text not null,
  status      text not null default 'active',
  claimed_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  redeemed_at timestamptz,
  redeemed_by uuid references identity.users (id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint coupon_claims_code_key unique (code),
  constraint coupon_claims_code_format check (code ~ '^ARP-[A-Z0-9]{6}$'),
  constraint coupon_claims_status_check check (status in ('active', 'redeemed', 'expired', 'cancelled')),
  constraint coupon_claims_expires_after_claimed check (expires_at > claimed_at),
  constraint coupon_claims_redeemed_at_check check ((status = 'redeemed') = (redeemed_at is not null)),
  constraint coupon_claims_redeemed_by_check check (redeemed_by is null or status = 'redeemed'),
  constraint coupon_claims_redeemed_after_claimed check (redeemed_at is null or redeemed_at >= claimed_at)
);

comment on column promotions.coupon_claims.code is 'Código mostrado no caixa (ARP-XXXXXX, alfabeto sem caracteres ambíguos).';
comment on column promotions.coupon_claims.status is
  'active = aguardando uso; redeemed = usado; expired = venceu (a unidade voltou); cancelled = desistiu. '
  'Active com expires_at < now() já conta como devolvido na leitura; o job só materializa expired.';
comment on column promotions.coupon_claims.redeemed_by is 'Usuário do painel que validou no caixa.';

-- Regra do app: um visitante só tem um cupom ATIVO por promoção (pode pegar de
-- novo depois de usar ou de vencer). Também protege contra duplo clique.
create unique index coupon_claims_one_active_per_visitor
  on promotions.coupon_claims (coupon_id, visitor_id)
  where status = 'active';
-- Estoque do cupom: count filter (status/expires_at) where coupon_id = $1.
-- Cobre a consulta inteira (index-only scan), inclusive para várias promoções.
create index coupon_claims_stock_idx on promotions.coupon_claims (coupon_id, status, expires_at);
-- Carteira do visitante e "últimos cupons" no detalhe do visitante.
create index coupon_claims_visitor_claimed_idx on promotions.coupon_claims (visitor_id, claimed_at desc);
-- Job de expiração: só os ativos, ordenados pelo vencimento.
create index coupon_claims_active_expires_idx on promotions.coupon_claims (expires_at)
  where status = 'active';
-- Dashboard: pegos por período.
create index coupon_claims_claimed_at_idx on promotions.coupon_claims (claimed_at);
-- Dashboard e painel do lojista: usados por período / por hora.
create index coupon_claims_redeemed_at_idx on promotions.coupon_claims (redeemed_at)
  where redeemed_at is not null;
create index coupon_claims_redeemed_by_idx on promotions.coupon_claims (redeemed_by)
  where redeemed_by is not null;

create trigger coupon_claims_set_updated_at
  before update on promotions.coupon_claims
  for each row when (old.* is distinct from new.*)
  execute function public.set_updated_at();

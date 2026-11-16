-- gamification: selos, campanhas mensais com faixas de benefício, desafios,
-- QR Codes que dão selo, selos conquistados e leituras de QR (analytics).

create schema if not exists gamification;

comment on schema gamification is 'Desafios mensais, selos e QR Codes.';

/* Selos ------------------------------------------------------------------ */

create table gamification.seals (
  id            uuid primary key default public.uuid_generate_v7(),
  slug          text not null,
  name          text not null,
  description   text,
  icon          text not null,
  gradient_from text not null,
  gradient_to   text not null,
  sort_order    integer not null default 0,
  status        text not null default 'active',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint seals_slug_key unique (slug),
  constraint seals_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint seals_name_not_blank check (btrim(name) <> ''),
  constraint seals_icon_format check (icon ~ '^[a-z0-9-]+$'),
  constraint seals_gradient_from_format check (gradient_from ~ '^#[0-9a-fA-F]{6}$'),
  constraint seals_gradient_to_format check (gradient_to ~ '^#[0-9a-fA-F]{6}$'),
  constraint seals_status_check check (status in ('active', 'archived'))
);

comment on table gamification.seals is 'Selo é reutilizável entre campanhas (o "Explorador" de outubro e o de novembro são o mesmo selo).';

create trigger seals_set_updated_at
  before update on gamification.seals
  for each row when (old.* is distinct from new.*)
  execute function public.set_updated_at();

/* Campanhas -------------------------------------------------------------- */

create table gamification.campaigns (
  id          uuid primary key default public.uuid_generate_v7(),
  name        text not null,
  description text,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  status      text not null default 'draft',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint campaigns_name_not_blank check (btrim(name) <> ''),
  constraint campaigns_status_check check (status in ('draft', 'published', 'archived')),
  constraint campaigns_period_check check (ends_at > starts_at)
);

comment on table gamification.campaigns is 'Ex.: "Desafios de outubro". QR Codes só dão selo enquanto a campanha publicada está no ar.';

-- Campanha no ar (status = published and now() between starts_at and ends_at).
create index campaigns_status_period_idx on gamification.campaigns (status, starts_at, ends_at);

create trigger campaigns_set_updated_at
  before update on gamification.campaigns
  for each row when (old.* is distinct from new.*)
  execute function public.set_updated_at();

/* Faixas de benefício ---------------------------------------------------- */

create table gamification.reward_tiers (
  id          uuid primary key default public.uuid_generate_v7(),
  campaign_id uuid not null references gamification.campaigns (id) on delete cascade,
  threshold   integer not null,
  label       text not null,
  icon        text not null,
  constraint reward_tiers_campaign_threshold_key unique (campaign_id, threshold),
  constraint reward_tiers_threshold_range check (threshold between 1 and 100),
  constraint reward_tiers_label_not_blank check (btrim(label) <> ''),
  constraint reward_tiers_icon_format check (icon ~ '^[a-z0-9-]+$')
);

comment on table gamification.reward_tiers is 'Ao juntar threshold selos na campanha, o visitante libera o benefício. Substituídas em bloco pela API.';

/* Desafios --------------------------------------------------------------- */

create table gamification.challenges (
  id          uuid primary key default public.uuid_generate_v7(),
  campaign_id uuid not null references gamification.campaigns (id),
  seal_id     uuid not null references gamification.seals (id),
  title       text not null,
  how_to      text not null,
  icon        text not null,
  validation  text not null,
  store_id    uuid references directory.stores (id),
  event_id    uuid references agenda.events (id),
  sort_order  integer not null default 0,
  status      text not null default 'active',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- Alvo da FK composta de earned_seals (garante campanha coerente com o desafio).
  constraint challenges_id_campaign_key unique (id, campaign_id),
  constraint challenges_title_not_blank check (btrim(title) <> ''),
  constraint challenges_icon_format check (icon ~ '^[a-z0-9-]+$'),
  constraint challenges_validation_check check (validation in ('qr', 'auto')),
  constraint challenges_status_check check (status in ('active', 'inactive'))
);

comment on column gamification.challenges.validation is 'qr = lê um QR Code; auto = validado por integração (ex.: pagar o estacionamento pelo app).';
comment on column gamification.challenges.event_id is 'Desafio ligado a um evento (events.awards_seal).';

create index challenges_campaign_sort_idx on gamification.challenges (campaign_id, sort_order);
create index challenges_seal_id_idx on gamification.challenges (seal_id);
create index challenges_store_id_idx on gamification.challenges (store_id) where store_id is not null;
create index challenges_event_id_idx on gamification.challenges (event_id) where event_id is not null;

create trigger challenges_set_updated_at
  before update on gamification.challenges
  for each row when (old.* is distinct from new.*)
  execute function public.set_updated_at();

/* QR Codes --------------------------------------------------------------- */

create table gamification.qr_codes (
  id           uuid primary key default public.uuid_generate_v7(),
  challenge_id uuid not null references gamification.challenges (id) on delete cascade,
  token        text not null,
  label        text not null,
  valid_from   timestamptz,
  valid_until  timestamptz,
  status       text not null default 'active',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint qr_codes_token_key unique (token),
  -- Alvo da FK composta de earned_seals (o QR precisa ser do mesmo desafio).
  constraint qr_codes_id_challenge_key unique (id, challenge_id),
  constraint qr_codes_token_format check (token ~ '^[A-Za-z0-9_-]{24,}$'),
  constraint qr_codes_label_not_blank check (btrim(label) <> ''),
  constraint qr_codes_status_check check (status in ('active', 'revoked')),
  constraint qr_codes_validity_check check (valid_until is null or valid_from is null or valid_until > valid_from)
);

comment on column gamification.qr_codes.token is
  'Aleatório url-safe (24+ caracteres, crypto). O QR codifica arp://selo/<token>; adivinhar um token válido é inviável.';
comment on column gamification.qr_codes.valid_from is 'Janela própria do QR (opcional), além do período da campanha.';

create index qr_codes_challenge_id_idx on gamification.qr_codes (challenge_id);

create trigger qr_codes_set_updated_at
  before update on gamification.qr_codes
  for each row when (old.* is distinct from new.*)
  execute function public.set_updated_at();

/* Selos conquistados ----------------------------------------------------- */

create table gamification.earned_seals (
  id           uuid primary key default public.uuid_generate_v7(),
  visitor_id   uuid not null references visitors.visitors (id),
  challenge_id uuid not null,
  seal_id      uuid not null references gamification.seals (id),
  campaign_id  uuid not null references gamification.campaigns (id),
  qr_code_id   uuid,
  earned_at    timestamptz not null default now(),
  -- Regra do app: o selo de um desafio sai uma vez por pessoa.
  constraint earned_seals_visitor_challenge_key unique (visitor_id, challenge_id),
  constraint earned_seals_challenge_fkey foreign key (challenge_id, campaign_id)
    references gamification.challenges (id, campaign_id),
  constraint earned_seals_qr_code_fkey foreign key (qr_code_id, challenge_id)
    references gamification.qr_codes (id, challenge_id)
);

comment on table gamification.earned_seals is
  'Selo dado a um visitante por um desafio. seal_id/campaign_id são cópia do desafio no momento (histórico não muda se o desafio trocar de selo).';
comment on column gamification.earned_seals.qr_code_id is 'QR lido (null em validação automática).';

-- Progresso do visitante na campanha e participantes/faixas alcançadas.
create index earned_seals_campaign_visitor_idx on gamification.earned_seals (campaign_id, visitor_id);
-- Dashboard: selos por período.
create index earned_seals_earned_at_idx on gamification.earned_seals (earned_at);
-- completionsCount do desafio e "apagar desafio sem selos".
create index earned_seals_challenge_id_idx on gamification.earned_seals (challenge_id);
-- earnedCount do selo.
create index earned_seals_seal_id_idx on gamification.earned_seals (seal_id);
create index earned_seals_qr_code_id_idx on gamification.earned_seals (qr_code_id) where qr_code_id is not null;

/* Leituras de QR --------------------------------------------------------- */

create table gamification.qr_scans (
  id         uuid primary key default public.uuid_generate_v7(),
  qr_code_id uuid references gamification.qr_codes (id) on delete set null,
  visitor_id uuid not null references visitors.visitors (id),
  result     text not null,
  scanned_at timestamptz not null default now(),
  constraint qr_scans_result_check check (result in ('awarded', 'duplicate', 'expired', 'invalid')),
  -- Só "invalid" (token desconhecido) pode não apontar para um QR.
  constraint qr_scans_qr_code_required check (qr_code_id is not null or result = 'invalid')
);

comment on table gamification.qr_scans is 'Toda leitura de QR, inclusive as recusadas (analytics e detecção de abuso). Só cresce.';

-- Contagem por resultado de cada QR (scans.awarded/duplicate/expired).
create index qr_scans_qr_code_result_idx on gamification.qr_scans (qr_code_id, result);
-- Dashboard: scanOutcomes por período.
create index qr_scans_scanned_at_idx on gamification.qr_scans (scanned_at);
-- Histórico/abuso por visitante.
create index qr_scans_visitor_scanned_idx on gamification.qr_scans (visitor_id, scanned_at desc);

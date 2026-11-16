-- marketing: destaques do carrossel da home (inclui mídia patrocinada) e
-- notificações push.

create schema if not exists marketing;

comment on schema marketing is 'Destaques da home e notificações push.';

/* Destaques -------------------------------------------------------------- */

create table marketing.highlights (
  id               uuid primary key default public.uuid_generate_v7(),
  title            text not null,
  subtitle         text,
  cta_label        text,
  image_url        text,
  badge            text not null default 'featured',
  target_type      text not null default 'none',
  target_id        uuid,
  target_url       text,
  sponsor_store_id uuid references directory.stores (id),
  starts_at        timestamptz not null,
  ends_at          timestamptz not null,
  sort_order       integer not null default 0,
  status           text not null default 'draft',
  impressions      bigint not null default 0,
  clicks           bigint not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint highlights_title_not_blank check (btrim(title) <> ''),
  constraint highlights_badge_check check (badge in ('featured', 'sponsored')),
  constraint highlights_target_type_check check (target_type in ('event', 'coupon', 'store', 'url', 'none')),
  -- O mesmo que highlightIssues() do contrato.
  constraint highlights_target_check check (
    case target_type
      when 'url' then target_url is not null
      when 'none' then true
      else target_id is not null
    end
  ),
  constraint highlights_status_check check (status in ('draft', 'published', 'archived')),
  constraint highlights_period_check check (ends_at > starts_at),
  constraint highlights_counters_non_negative check (impressions >= 0 and clicks >= 0)
);

comment on column marketing.highlights.badge is 'featured = "Destaque" da ARP; sponsored = "Patrocinado" (vendido pelo comercial).';
comment on column marketing.highlights.target_id is
  'Id do evento, cupom ou loja conforme target_type. Sem FK (polimórfico): a API valida ao gravar; esses alvos não são apagados, só desativados.';
comment on column marketing.highlights.sponsor_store_id is 'Loja que pagou pelo destaque patrocinado (relatório do comercial).';
comment on column marketing.highlights.impressions is 'Contador incrementado pelo app (update … set impressions = impressions + 1).';

-- Carrossel do app: publicados no ar agora, na ordem.
create index highlights_status_period_idx on marketing.highlights (status, starts_at, ends_at);
create index highlights_sponsor_store_id_idx on marketing.highlights (sponsor_store_id)
  where sponsor_store_id is not null;

create trigger highlights_set_updated_at
  before update on marketing.highlights
  for each row when (old.* is distinct from new.*)
  execute function public.set_updated_at();

/* Notificações push ------------------------------------------------------ */

create table marketing.push_notifications (
  id               uuid primary key default public.uuid_generate_v7(),
  title            text not null,
  body             text not null,
  audience         text not null,
  store_id         uuid references directory.stores (id),
  deep_link        text,
  scheduled_at     timestamptz,
  sent_at          timestamptz,
  status           text not null default 'draft',
  recipients_count integer,
  created_by       uuid not null references identity.users (id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint push_notifications_title_not_blank check (btrim(title) <> ''),
  constraint push_notifications_body_not_blank check (btrim(body) <> ''),
  constraint push_notifications_audience_check check (audience in ('all', 'opted_in', 'store_followers')),
  constraint push_notifications_store_required check (audience <> 'store_followers' or store_id is not null),
  constraint push_notifications_status_check check (status in ('draft', 'scheduled', 'sent', 'cancelled')),
  constraint push_notifications_scheduled_check check (status <> 'scheduled' or scheduled_at is not null),
  constraint push_notifications_sent_check check ((status = 'sent') = (sent_at is not null)),
  constraint push_notifications_recipients_non_negative check (recipients_count >= 0)
);

comment on column marketing.push_notifications.deep_link is 'Tela do app que abre ao tocar (ex.: arp://cupom/<id>).';
comment on column marketing.push_notifications.recipients_count is 'Estimativa ao agendar; número real depois do envio.';

-- Job de disparo: status = 'scheduled' and scheduled_at <= now().
create index push_notifications_status_scheduled_idx on marketing.push_notifications (status, scheduled_at);
create index push_notifications_store_id_idx on marketing.push_notifications (store_id) where store_id is not null;
create index push_notifications_created_by_idx on marketing.push_notifications (created_by);

create trigger push_notifications_set_updated_at
  before update on marketing.push_notifications
  for each row when (old.* is distinct from new.*)
  execute function public.set_updated_at();

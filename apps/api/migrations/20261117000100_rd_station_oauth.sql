-- RD Station Marketing por OAuth (app "ARP ControlApp" na RD Station App Store),
-- configurado pelo painel em Integrações. Substitui as variáveis RD_STATION_*.

/* Configuração (linha única) --------------------------------------------- */

create table platform.rd_station (
  id                smallint primary key default 1 check (id = 1),
  client_id         text not null,
  -- Cifrados na API (AES-256-GCM, INTEGRATIONS_SECRET). Nunca voltam ao painel.
  client_secret_enc text,
  refresh_token_enc text,
  conversion        text,
  active            boolean not null default true,
  status            text not null default 'disconnected'
                    check (status in ('disconnected', 'connected', 'error')),
  message           text,
  tested_at         timestamptz,
  configured_at     timestamptz not null default now(),
  configured_by     uuid references identity.users (id) on delete set null
);

comment on table platform.rd_station is
  'Acesso ao RD Station Marketing (OAuth). Sem linha = não configurado. O job rd-station-leads só envia com active, refresh token e conversão.';

/* Contato recusado não trava a fila -------------------------------------- */

alter table visitors.visitors add column rd_error text;

comment on column visitors.visitors.rd_error is
  'Por que o RD recusou o contato (ex.: e-mail inválido). Preenchido = o job pula; limpar para tentar de novo.';

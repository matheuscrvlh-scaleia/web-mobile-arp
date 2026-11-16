/*
 * Dados fictícios de demonstração (seed/demo.ts).
 *
 * is_demo marca o que o gerador criou: o painel mostra um ícone nessas linhas
 * e o app nunca exibe cupom, campanha ou prêmio fictício. O que pende de um
 * visitante fictício (cupons pegos, selos, leituras de QR, trocas) é fictício
 * por tabela; desafios seguem a campanha.
 */

alter table visitors.visitors add column is_demo boolean not null default false;
alter table promotions.coupons add column is_demo boolean not null default false;
alter table gamification.campaigns add column is_demo boolean not null default false;
alter table gamification.prizes add column is_demo boolean not null default false;
alter table marketing.push_notifications add column is_demo boolean not null default false;

comment on column visitors.visitors.is_demo is 'Visitante fictício de demonstração (não entra login, ranking nem público de push).';
comment on column promotions.coupons.is_demo is 'Cupom fictício de demonstração: só no painel, nunca no app.';
comment on column gamification.campaigns.is_demo is 'Campanha fictícia de demonstração: só no painel, nunca no app.';
comment on column gamification.prizes.is_demo is 'Prêmio fictício de demonstração: só no painel, nunca na lojinha do app.';
comment on column marketing.push_notifications.is_demo is 'Notificação fictícia de demonstração (histórico; nunca é enviada).';

-- Remoção e "tem dado fictício?" sem varrer a tabela.
create index visitors_demo_idx on visitors.visitors (id) where is_demo;
create index coupons_demo_idx on promotions.coupons (id) where is_demo;

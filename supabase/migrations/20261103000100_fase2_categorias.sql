/*
 * Fase 2: as 3 categorias do app (Lojas, Gastronomia, Serviços) com as
 * subcategorias do site da ARP, e mais de uma categoria por estabelecimento.
 *
 * - store_categories.kind ganha 'service' (Serviços). As linhas continuam
 *   sendo as subcategorias; kind diz em qual das 3 categorias elas ficam.
 * - stores.category_id segue como a subcategoria principal.
 * - store_extra_categories guarda as extras: a loja aparece em todas.
 * - As subcategorias do site entram aqui (se ainda não existirem). As
 *   categorias antigas ficam como estão: a ARP reclassifica as lojas pelo
 *   painel e apaga as que sobrarem sem loja.
 */

alter table directory.store_categories drop constraint store_categories_kind_check;
alter table directory.store_categories
  add constraint store_categories_kind_check check (kind in ('shop', 'food', 'service'));

comment on column directory.store_categories.kind is
  'Em qual das 3 categorias do app a subcategoria fica: shop = Lojas, food = Gastronomia, service = Serviços.';

create table directory.store_extra_categories (
  store_id    uuid not null references directory.stores (id) on delete cascade,
  category_id uuid not null references directory.store_categories (id) on delete restrict,
  created_at  timestamptz not null default now(),
  constraint store_extra_categories_pkey primary key (store_id, category_id)
);

create index store_extra_categories_category_idx
  on directory.store_extra_categories (category_id);

alter table directory.store_extra_categories enable row level security;

comment on table directory.store_extra_categories is
  'Subcategorias extras da loja (além de stores.category_id). Ex.: loja de roupas que também é café aparece em Lojas e em Gastronomia. A API substitui todas as linhas da loja ao editar.';

insert into directory.store_categories (name, kind, icon, sort_order)
values
  ('Acessórios', 'shop', 'gem', 1),
  ('Moda', 'shop', 'shirt', 2),
  ('Utilidades', 'shop', 'house', 3),
  ('Varejo', 'shop', 'shopping-bag', 4),
  ('Bar', 'food', 'beer', 1),
  ('Confeitaria e Café', 'food', 'coffee', 2),
  ('Padaria e Lanchonete', 'food', 'croissant', 3),
  ('Pizzaria', 'food', 'pizza', 4),
  ('Produtos Naturais', 'food', 'leaf', 5),
  ('Restaurante', 'food', 'utensils', 6),
  ('Sorveteria', 'food', 'ice-cream-cone', 7),
  ('Academia', 'service', 'dumbbell', 1),
  ('Advocacia', 'service', 'landmark', 2),
  ('Agência e Eventos', 'service', 'party-popper', 3),
  ('Arquitetura e Engenharia', 'service', 'building-2', 4),
  ('Ateliê', 'service', 'scissors', 5),
  ('Contabilidade e Finanças', 'service', 'banknote', 6),
  ('Ensino', 'service', 'book-open', 7),
  ('Estética e Beleza', 'service', 'sparkles', 8),
  ('Fotografia', 'service', 'camera', 9),
  ('Imobiliária e Corretora', 'service', 'key-round', 10),
  ('Indústria', 'service', 'hammer', 11),
  ('Lazer', 'service', 'gamepad-2', 12),
  ('Saúde', 'service', 'stethoscope', 13),
  ('Tecnologia', 'service', 'laptop', 14),
  ('Veterinária', 'service', 'paw-print', 15)
on conflict (name, kind) do nothing;

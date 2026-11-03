import { type SqlFragment, sql } from "./sql";

/*
 * Categorias da loja `s` (Fase 2): a principal fica em s.category_id e as
 * extras em directory.store_extra_categories. A loja aparece em todas. Os
 * fragmentos assumem o alias `s` para directory.stores.
 */

/** A loja `s` está na subcategoria `id` (principal ou extra); `id` pode ser uma coluna (sql.raw). */
export function storeInCategory(id: string | SqlFragment): SqlFragment {
  return sql`(s.category_id = ${id} or exists (
    select 1 from directory.store_extra_categories x
    where x.store_id = s.id and x.category_id = ${id}))`;
}

/** A loja `s` tem alguma subcategoria do tipo `kind` (Lojas, Gastronomia, Serviços). */
export function storeHasKind(kind: string): SqlFragment {
  return sql`exists (
    select 1 from directory.store_categories k
    where k.kind = ${kind}
      and (k.id = s.category_id or exists (
        select 1 from directory.store_extra_categories x
        where x.store_id = s.id and x.category_id = k.id)))`;
}

/** Subcategorias extras da loja `s`: [{ id, name, kind }]. */
export const STORE_EXTRA_CATEGORIES_JSON = sql`
  coalesce((
    select json_agg(json_build_object('id', k.id, 'name', k.name, 'kind', k.kind)
                    order by k.sort_order, k.name)
    from directory.store_extra_categories x
    join directory.store_categories k on k.id = x.category_id
    where x.store_id = s.id
  ), '[]'::json)
`;

/** Tipos da loja `s` (principal + extras), na ordem Lojas, Gastronomia, Serviços. */
export const STORE_KINDS_JSON = sql`
  coalesce((
    select json_agg(t.kind order by array_position(array['shop','food','service'], t.kind))
    from (
      select k.kind from directory.store_categories k
      where k.id = s.category_id or exists (
        select 1 from directory.store_extra_categories x
        where x.store_id = s.id and x.category_id = k.id)
      group by k.kind
    ) t
  ), '[]'::json)
`;

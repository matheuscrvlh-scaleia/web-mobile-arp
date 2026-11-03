import type { App, MapShape } from "@arp/contracts";
import { offsetOf, type Page, toPage } from "../../../shared/application/pagination";
import { toLocal } from "../../../shared/domain/time";
import type { Database } from "../../../shared/infra/database/database";
import { type SqlFragment, sql } from "../../../shared/infra/database/sql";
import {
  STORE_EXTRA_CATEGORIES_JSON,
  STORE_KINDS_JSON,
  storeHasKind,
  storeInCategory,
} from "../../../shared/infra/database/store-categories";
import { type DailyHours, isOpenNow } from "../../directory/domain/opening-hours";
import {
  type ChallengeRow,
  type CouponCardRow,
  challengeSelect,
  couponCardSelect,
  liveCampaignId,
  liveCoupon,
  toChallengeItem,
  toCouponCard,
} from "./fragments";

type Kind = App.StoreSummary["category"]["kind"];

interface StoreSummaryRow {
  id: string;
  slug: string;
  name: string;
  icon: string;
  brand_color: string;
  cover_image_url: string | null;
  category_id: string;
  category_name: string;
  kind: Kind;
  extra_categories: App.StoreSummary["extraCategories"];
  kinds: Kind[];
  floor_id: string;
  floor_label: string;
  floor_short_label: string;
  floor_level: number;
  block_id: string;
  block_name: string;
  hours: DailyHours[];
  active_coupons_count: number;
  is_favorite: boolean;
}

interface StoreDetailRow extends StoreSummaryRow {
  description: string;
  logo_url: string | null;
  phone: string | null;
  whatsapp: string | null;
  instagram: string | null;
  website: string | null;
  map_x: number | null;
  map_y: number | null;
  is_following: boolean;
}

/**
 * "Aberto agora" no SQL, para a paginação contar só as abertas. Espelha
 * isOpenAt: fechar no mesmo horário ou antes de abrir = passa da meia-noite
 * (vale a noite do dia e a madrugada do dia seguinte).
 */
function openNowFilter(now: Date): SqlFragment {
  const local = toLocal(now);
  const time = `${String(local.hour).padStart(2, "0")}:${String(local.minute).padStart(2, "0")}`;
  const previous = (local.weekday + 6) % 7;
  return sql`exists (
    select 1 from directory.store_hours h
    where h.store_id = s.id and (
      (h.closes_at > h.opens_at and h.weekday = ${local.weekday}
        and ${time}::time >= h.opens_at and ${time}::time < h.closes_at)
      or (h.closes_at <= h.opens_at and (
        (h.weekday = ${local.weekday} and ${time}::time >= h.opens_at)
        or (h.weekday = ${previous} and ${time}::time < h.closes_at)))
    )
  )`;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Colunas do cartão de loja (aliases s, sc, f, b). Horários vêm em JSON para o "aberto agora". */
const storeSummarySelect = (
  now: Date,
  visitorId: string | null,
  extra: SqlFragment = sql.empty,
) => sql`
  select s.id, s.slug, s.name, s.icon, s.brand_color, s.cover_image_url,
         sc.id as category_id, sc.name as category_name, sc.kind,
         ${STORE_EXTRA_CATEGORIES_JSON} as extra_categories, ${STORE_KINDS_JSON} as kinds,
         f.id as floor_id, f.label as floor_label, f.short_label as floor_short_label,
         f.level as floor_level, b.id as block_id, b.name as block_name,
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'weekday', h.weekday,
                    'opensAt', to_char(h.opens_at, 'HH24:MI'),
                    'closesAt', to_char(h.closes_at, 'HH24:MI')) order by h.weekday)
           from directory.store_hours h where h.store_id = s.id
         ), '[]'::jsonb) as hours,
         (select count(*) from promotions.coupons c
          where c.store_id = s.id and ${liveCoupon(now)}) as active_coupons_count,
         exists(select 1 from visitors.favorite_stores fs
                where fs.store_id = s.id and fs.visitor_id = ${visitorId}::uuid) as is_favorite
         ${extra}
  from directory.stores s
  join directory.store_categories sc on sc.id = s.category_id
  join directory.floors f on f.id = s.floor_id
  join directory.blocks b on b.id = s.block_id
`;

function toStoreSummary(r: StoreSummaryRow, now: Date): App.StoreSummary {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    category: { id: r.category_id, name: r.category_name, kind: r.kind },
    extraCategories: r.extra_categories,
    kinds: r.kinds,
    floor: {
      id: r.floor_id,
      label: r.floor_label,
      shortLabel: r.floor_short_label,
      level: r.floor_level,
    },
    block: { id: r.block_id, name: r.block_name },
    icon: r.icon,
    brandColor: r.brand_color,
    coverImageUrl: r.cover_image_url,
    isOpenNow: isOpenNow(r.hours, now),
    activeCouponsCount: r.active_coupons_count,
    isFavorite: r.is_favorite,
  };
}

/** Guia de lojas e mapa do app. */
export class CatalogQueries {
  constructor(private readonly db: Database) {}

  async categories(): Promise<App.StoreCategory[]> {
    // Só categorias com loja ativa: chip sem resultado não ajuda no app.
    return this.db.many<App.StoreCategory>(sql`
      select sc.id, sc.name, sc.kind, sc.icon
      from directory.store_categories sc
      where exists (select 1 from directory.stores s
                    where ${storeInCategory(sql.raw("sc.id"))} and s.status = 'active')
      order by array_position(array['shop','food','service'], sc.kind), sc.sort_order, sc.name
    `);
  }

  async stores(
    query: App.ListStoresQuery,
    visitorId: string | null,
    now: Date,
  ): Promise<Page<App.StoreSummary>> {
    const rows = await this.db.many<StoreSummaryRow & { total: number }>(sql`
      ${storeSummarySelect(now, visitorId, sql`, count(*) over() as total`)}
      ${sql.where([
        sql`s.status = 'active'`,
        query.kind && storeHasKind(query.kind),
        query.categoryId && storeInCategory(query.categoryId),
        query.floorId && sql`s.floor_id = ${query.floorId}`,
        query.openNow && openNowFilter(now),
        query.q && sql`public.f_unaccent(lower(s.name)) like ${sql.containsPattern(query.q)}`,
      ])}
      order by s.name, s.id
      limit ${query.pageSize} offset ${offsetOf(query)}
    `);
    return toPage(rows, query, (r) => toStoreSummary(r, now));
  }

  /** Quais destas lojas o visitante favoritou (camada pessoal sobre a lista compartilhada). */
  async favoriteIds(visitorId: string, storeIds: readonly string[]): Promise<Set<string>> {
    if (storeIds.length === 0) return new Set();
    const rows = await this.db.many<{ store_id: string }>(sql`
      select store_id from visitors.favorite_stores
      where visitor_id = ${visitorId} and store_id = any(${storeIds}::uuid[])
    `);
    return new Set(rows.map((r) => r.store_id));
  }

  /** Favorita/segue a loja (camada pessoal sobre o detalhe compartilhado). */
  async storeFlags(
    visitorId: string,
    storeId: string,
  ): Promise<{ isFavorite: boolean; isFollowing: boolean }> {
    const row = await this.db.one<{ is_favorite: boolean; is_following: boolean }>(sql`
      select
        exists(select 1 from visitors.favorite_stores
               where visitor_id = ${visitorId} and store_id = ${storeId}) as is_favorite,
        exists(select 1 from visitors.store_follows
               where visitor_id = ${visitorId} and store_id = ${storeId}) as is_following
    `);
    return { isFavorite: row.is_favorite, isFollowing: row.is_following };
  }

  async favorites(visitorId: string, now: Date): Promise<App.StoreSummary[]> {
    const rows = await this.db.many<StoreSummaryRow>(sql`
      ${storeSummarySelect(now, visitorId)}
      where s.status = 'active'
        and exists (select 1 from visitors.favorite_stores fs
                    where fs.store_id = s.id and fs.visitor_id = ${visitorId})
      order by s.name
    `);
    return rows.map((r) => toStoreSummary(r, now));
  }

  async store(
    idOrSlug: string,
    visitorId: string | null,
    now: Date,
  ): Promise<App.StoreDetail | null> {
    const key = UUID.test(idOrSlug) ? sql`s.id = ${idOrSlug}` : sql`s.slug = ${idOrSlug}`;
    const row = await this.db.maybeOne<StoreDetailRow>(sql`
      ${storeSummarySelect(
        now,
        visitorId,
        sql`, s.description, s.logo_url, s.phone, s.whatsapp, s.instagram, s.website,
              s.map_x, s.map_y,
              exists(select 1 from visitors.store_follows sf
                     where sf.store_id = s.id and sf.visitor_id = ${visitorId}::uuid) as is_following`,
      )}
      where ${key} and s.status = 'active'
    `);
    if (!row) return null;

    const coupons = await this.db.many<CouponCardRow>(sql`
      ${couponCardSelect(now)}
      where c.store_id = ${row.id} and ${liveCoupon(now)}
      order by c.starts_at desc
    `);
    const challenge = await this.db.maybeOne<ChallengeRow>(sql`
      ${challengeSelect(visitorId)}
      where ch.store_id = ${row.id} and ch.status = 'active'
        and ch.campaign_id = ${liveCampaignId(now)}
      order by ch.sort_order
      limit 1
    `);

    return {
      ...toStoreSummary(row, now),
      description: row.description,
      logoUrl: row.logo_url,
      phone: row.phone,
      whatsapp: row.whatsapp,
      instagram: row.instagram,
      website: row.website,
      mapX: row.map_x,
      mapY: row.map_y,
      hours: row.hours,
      coupons: coupons.map(toCouponCard),
      challenge: challenge ? toChallengeItem(challenge) : null,
      isFollowing: row.is_following,
    };
  }

  async map(): Promise<App.MapData> {
    const floors = await this.db.many<{
      id: string;
      level: number;
      label: string;
      short_label: string;
      layout: MapShape[];
      points: App.MapData["floors"][number]["points"];
      pins: App.MapData["floors"][number]["pins"];
    }>(sql`
      select f.id, f.level, f.label, f.short_label, f.layout,
             coalesce((
               select jsonb_agg(jsonb_build_object(
                        'id', p.id, 'icon', p.icon, 'label', p.label, 'x', p.x, 'y', p.y)
                      order by p.label)
               from directory.map_points p where p.floor_id = f.id
             ), '[]'::jsonb) as points,
             coalesce((
               select jsonb_agg(jsonb_build_object(
                        'storeId', s.id, 'slug', s.slug, 'name', s.name, 'icon', s.icon,
                        'brandColor', s.brand_color, 'kind', sc.kind,
                        'kinds', ${STORE_KINDS_JSON}, 'x', s.map_x, 'y', s.map_y)
                      order by s.name)
               from directory.stores s
               join directory.store_categories sc on sc.id = s.category_id
               where s.floor_id = f.id and s.status = 'active' and s.map_x is not null
             ), '[]'::jsonb) as pins
      from directory.floors f
      order by f.level
    `);
    return {
      floors: floors.map((f) => ({
        id: f.id,
        level: f.level,
        label: f.label,
        shortLabel: f.short_label,
        layout: f.layout,
        points: f.points,
        pins: f.pins,
      })),
    };
  }
}

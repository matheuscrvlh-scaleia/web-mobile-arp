import {
  type Block,
  type Floor,
  type ListStoresQuery,
  type MapPoint,
  type MapShape,
  type MetricsPeriod,
  type StoreCategory,
  type StoreCategoryRef,
  type StoreDetail,
  type StoreGap,
  type StoreKind,
  type StoreMetrics,
  type StoreOption,
  type StorePin,
  type StoreSort,
  type StoreStatus,
  type StoreSummary,
  storeGapSchema,
} from "@arp/contracts";
import { offsetOf, type Page, toPage } from "../../../shared/application/pagination";
import type { Clock } from "../../../shared/application/ports/clock";
import type { Database } from "../../../shared/infra/database/database";
import { type SqlFragment, sql } from "../../../shared/infra/database/sql";
import {
  STORE_EXTRA_CATEGORIES_JSON,
  storeHasKind,
  storeInCategory,
} from "../../../shared/infra/database/store-categories";
import { iso } from "../../../shared/infra/presenters";
import { type DailyHours, isOpenNow } from "../domain/opening-hours";
import {
  STORE_HOURS_JSON,
  STORE_USAGE_COLUMNS,
  type StoreUsageRow,
  toStoreUsage,
} from "./fragments";

interface StoreSummaryRow {
  id: string;
  slug: string;
  name: string;
  category_id: string;
  category_name: string;
  category_kind: StoreKind;
  extra_categories: StoreCategoryRef[];
  block_id: string;
  block_name: string;
  floor_id: string;
  floor_label: string;
  floor_short_label: string;
  floor_level: number;
  icon: string;
  brand_color: string;
  cover_image_url: string | null;
  status: StoreStatus;
  map_x: number | null;
  map_y: number | null;
  active_coupons_count: number;
  hours: DailyHours[];
  missing: StoreGap[];
  updated_at: Date;
}

/**
 * Pendências do cadastro da loja `s`, na ordem do contrato. Cada uma tem a
 * condição SQL (filtro "Pendências") e entra na lista `missing` do resumo.
 */
const GAP_CONDITIONS: Record<StoreGap, SqlFragment> = {
  hours: sql`not exists (select 1 from directory.store_hours h where h.store_id = s.id)`,
  cover: sql`s.cover_image_url is null`,
  logo: sql`s.logo_url is null`,
  map: sql`(s.map_x is null or s.map_y is null)`,
  description: sql`btrim(s.description) = ''`,
};
const GAPS = storeGapSchema.options;

const MISSING_COLUMN = sql`array_remove(array[${sql.join(
  GAPS.map((g) => sql`case when ${GAP_CONDITIONS[g]} then ${sql.raw(`'${g}'`)} end`),
)}]::text[], null)`;

/** Ordem da lista; o nome desempata (e o id, para a paginação ser estável). */
const SORT_COLUMN: Record<StoreSort, string> = {
  name: "s.name",
  category: "c.name",
  block: "b.sort_order",
  floor: "f.level",
  updated: "s.updated_at",
};

function orderBy(query: ListStoresQuery): SqlFragment {
  const sort = query.sort ?? "name";
  const dir = query.order === "desc" ? "desc" : "asc";
  const tie = sort === "block" ? ", b.name" : "";
  return sql.raw(`order by ${SORT_COLUMN[sort]} ${dir}${tie}, s.name, s.id`);
}

/**
 * Busca por palavras em qualquer ordem ("pontal cerv" acha "Cervejaria
 * Pontal"): cada palavra precisa estar no nome, na categoria (principal ou
 * extra) ou na descrição.
 */
function searchCondition(q: string): SqlFragment | undefined {
  const words = q.split(/\s+/).filter(Boolean).slice(0, 6);
  if (words.length === 0) return undefined;
  return sql.and(
    words.map((w) => {
      const p = sql.containsPattern(w);
      return sql.or([
        sql`public.f_unaccent(lower(s.name)) like ${p}`,
        sql`public.f_unaccent(lower(c.name)) like ${p}`,
        sql`public.f_unaccent(lower(s.description)) like ${p}`,
        sql`exists (select 1 from directory.store_extra_categories xc
                    join directory.store_categories xcat on xcat.id = xc.category_id
                    where xc.store_id = s.id and public.f_unaccent(lower(xcat.name)) like ${p})`,
      ]);
    }),
  );
}

/** Colunas e joins do resumo da loja (lista e detalhe), com horários e cupons no ar. */
const SUMMARY_COLUMNS = sql`
  s.id, s.slug, s.name, s.icon, s.brand_color, s.cover_image_url, s.status, s.map_x, s.map_y,
  s.updated_at, ${MISSING_COLUMN} as missing,
  c.id as category_id, c.name as category_name, c.kind as category_kind,
  ${STORE_EXTRA_CATEGORIES_JSON} as extra_categories,
  b.id as block_id, b.name as block_name,
  f.id as floor_id, f.label as floor_label, f.short_label as floor_short_label, f.level as floor_level,
  (select count(*) from promotions.coupons cp
     where cp.store_id = s.id and cp.status = 'active' and cp.starts_at <= now()
       and (cp.ends_at is null or cp.ends_at > now())) as active_coupons_count,
  ${STORE_HOURS_JSON} as hours
`;

const SUMMARY_FROM = sql`
  from directory.stores s
  join directory.store_categories c on c.id = s.category_id
  join directory.blocks b on b.id = s.block_id
  join directory.floors f on f.id = s.floor_id
`;

/** Início do período no fuso de São Paulo (hoje = desde a meia-noite local). */
const PERIOD_DAYS: Record<MetricsPeriod, number> = { today: 1, "7d": 7, "30d": 30, "90d": 90 };

function periodStart(period: MetricsPeriod): SqlFragment {
  return sql`((date_trunc('day', now() at time zone 'America/Sao_Paulo')
              - make_interval(days => ${PERIOD_DAYS[period] - 1}))
              at time zone 'America/Sao_Paulo')`;
}

/** Leituras do guia (lojas, mapa, cadastros), já no formato do contrato. */
export class DirectoryQueries {
  constructor(
    private readonly db: Database,
    private readonly clock: Clock,
  ) {}

  private toSummary(r: StoreSummaryRow, now: Date): StoreSummary {
    return {
      id: r.id,
      slug: r.slug,
      name: r.name,
      category: { id: r.category_id, name: r.category_name, kind: r.category_kind },
      extraCategories: r.extra_categories,
      block: { id: r.block_id, name: r.block_name },
      floor: {
        id: r.floor_id,
        label: r.floor_label,
        shortLabel: r.floor_short_label,
        level: r.floor_level,
      },
      icon: r.icon,
      brandColor: r.brand_color,
      coverImageUrl: r.cover_image_url,
      status: r.status,
      activeCouponsCount: r.active_coupons_count,
      isOpenNow: r.status === "active" && isOpenNow(r.hours, now),
      hasHours: r.hours.length > 0,
      missing: r.missing,
      mapX: r.map_x,
      mapY: r.map_y,
      updatedAt: iso(r.updated_at),
    };
  }

  /** `storeId` presente = escopo do lojista (só a própria loja). */
  async listStores(query: ListStoresQuery, storeId?: string): Promise<Page<StoreSummary>> {
    const rows = await this.db.many<StoreSummaryRow & { total: number }>(sql`
      select ${SUMMARY_COLUMNS}, count(*) over() as total
      ${SUMMARY_FROM}
      ${sql.where([
        storeId && sql`s.id = ${storeId}`,
        query.kind && storeHasKind(query.kind),
        query.categoryId && storeInCategory(query.categoryId),
        query.blockId && sql`s.block_id = ${query.blockId}`,
        query.floorId && sql`s.floor_id = ${query.floorId}`,
        query.status && sql`s.status = ${query.status}`,
        query.missing &&
          (query.missing === "any"
            ? sql.or(GAPS.map((g) => GAP_CONDITIONS[g]))
            : GAP_CONDITIONS[query.missing]),
        query.q && searchCondition(query.q),
      ])}
      ${orderBy(query)}
      limit ${query.pageSize} offset ${offsetOf(query)}
    `);
    const now = this.clock.now();
    return toPage(rows, query, (r) => this.toSummary(r, now));
  }

  async getStore(id: string): Promise<StoreDetail | null> {
    const row = await this.db.maybeOne<
      StoreSummaryRow &
        StoreUsageRow & {
          description: string;
          logo_url: string | null;
          phone: string | null;
          whatsapp: string | null;
          instagram: string | null;
          website: string | null;
          followers_count: number;
          favorites_count: number;
          created_at: Date;
        }
    >(sql`
      select ${SUMMARY_COLUMNS},
             s.description, s.logo_url, s.phone, s.whatsapp, s.instagram, s.website,
             s.created_at, ${STORE_USAGE_COLUMNS},
             (select count(*) from visitors.store_follows sf where sf.store_id = s.id) as followers_count,
             (select count(*) from visitors.favorite_stores fs where fs.store_id = s.id) as favorites_count
      ${SUMMARY_FROM}
      where s.id = ${id}
    `);
    if (!row) return null;
    return {
      ...this.toSummary(row, this.clock.now()),
      description: row.description,
      logoUrl: row.logo_url,
      phone: row.phone,
      whatsapp: row.whatsapp,
      instagram: row.instagram,
      website: row.website,
      hours: row.hours,
      followersCount: row.followers_count,
      favoritesCount: row.favorites_count,
      usage: toStoreUsage(row),
      createdAt: iso(row.created_at),
    };
  }

  /**
   * Todas as lojas do andar para o editor do mapa, sem paginação (um andar
   * tem dezenas de lojas): com e sem posição, ativas e inativas. null = o
   * andar não existe. `storeId` presente = escopo do lojista.
   */
  async listStorePins(floorId: string, storeId?: string): Promise<StorePin[] | null> {
    const floorExists = await this.db.exists(
      sql`select 1 from directory.floors where id = ${floorId}`,
    );
    if (!floorExists) return null;
    const rows = await this.db.many<{
      id: string;
      name: string;
      icon: string;
      brand_color: string;
      status: StoreStatus;
      map_x: number | null;
      map_y: number | null;
      category_id: string;
      category_name: string;
      category_kind: StoreKind;
      block_id: string;
      block_name: string;
    }>(sql`
      select s.id, s.name, s.icon, s.brand_color, s.status, s.map_x, s.map_y,
             c.id as category_id, c.name as category_name, c.kind as category_kind,
             b.id as block_id, b.name as block_name
      from directory.stores s
      join directory.store_categories c on c.id = s.category_id
      join directory.blocks b on b.id = s.block_id
      ${sql.where([sql`s.floor_id = ${floorId}`, storeId && sql`s.id = ${storeId}`])}
      order by s.name, s.id
    `);
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      icon: r.icon,
      brandColor: r.brand_color,
      status: r.status,
      category: { id: r.category_id, name: r.category_name, kind: r.category_kind },
      block: { id: r.block_id, name: r.block_name },
      mapX: r.map_x,
      mapY: r.map_y,
    }));
  }

  async storeOptions(): Promise<StoreOption[]> {
    return this.db.many<StoreOption>(sql`
      select s.id, s.name, s.icon, s.brand_color as "brandColor", c.kind,
             f.label as "floorLabel", b.name as "blockName"
      from directory.stores s
      join directory.store_categories c on c.id = s.category_id
      join directory.floors f on f.id = s.floor_id
      join directory.blocks b on b.id = s.block_id
      where s.status = 'active'
      order by s.name
    `);
  }

  async listFloors(id?: string): Promise<Floor[]> {
    const rows = await this.db.many<{
      id: string;
      level: number;
      label: string;
      short_label: string;
      layout: MapShape[];
      background_url: string | null;
      stores_count: number;
      created_at: Date;
      updated_at: Date;
    }>(sql`
      select f.id, f.level, f.label, f.short_label, f.layout, f.background_url,
             f.created_at, f.updated_at,
             (select count(*) from directory.stores s where s.floor_id = f.id) as stores_count
      from directory.floors f
      ${sql.where([id && sql`f.id = ${id}`])}
      order by f.level
    `);
    return rows.map((r) => ({
      id: r.id,
      level: r.level,
      label: r.label,
      shortLabel: r.short_label,
      layout: r.layout,
      backgroundImageUrl: r.background_url,
      storesCount: r.stores_count,
      createdAt: iso(r.created_at),
      updatedAt: iso(r.updated_at),
    }));
  }

  async listBlocks(id?: string): Promise<Block[]> {
    return this.db.many<Block>(sql`
      select b.id, b.name, b.sort_order as "sortOrder",
             (select count(*) from directory.stores s where s.block_id = b.id) as "storesCount"
      from directory.blocks b
      ${sql.where([id && sql`b.id = ${id}`])}
      order by b.sort_order, b.name
    `);
  }

  async listStoreCategories(id?: string): Promise<StoreCategory[]> {
    return this.db.many<StoreCategory>(sql`
      select c.id, c.name, c.kind, c.icon, c.sort_order as "sortOrder",
             (select count(*) from directory.stores s where ${storeInCategory(sql.raw("c.id"))}) as "storesCount"
      from directory.store_categories c
      ${sql.where([id && sql`c.id = ${id}`])}
      order by array_position(array['shop','food','service'], c.kind), c.sort_order, c.name
    `);
  }

  async listMapPoints(filter: { floorId?: string; id?: string }): Promise<MapPoint[]> {
    return this.db.many<MapPoint>(sql`
      select p.id, p.floor_id as "floorId", p.icon, p.label, p.x, p.y
      from directory.map_points p
      ${sql.where([
        filter.floorId && sql`p.floor_id = ${filter.floorId}`,
        filter.id && sql`p.id = ${filter.id}`,
      ])}
      order by p.label
    `);
  }

  /** Painel do lojista: cupons da loja no período (fuso de São Paulo). */
  async storeMetrics(storeId: string, period: MetricsPeriod): Promise<StoreMetrics> {
    const start = periodStart(period);
    const row = await this.db.one<{
      released: number;
      claimed: number;
      waiting: number;
      redeemed: number;
      returned: number;
      by_hour: { hour: number; count: number }[];
      last_redemptions: { code: string; couponTitle: string; redeemedAt: string }[];
      followers_count: number;
      favorites_count: number;
    }>(sql`
      with store_claims as (
        select cl.code, cl.status, cl.claimed_at, cl.expires_at, cl.redeemed_at, cp.title
        from promotions.coupon_claims cl
        join promotions.coupons cp on cp.id = cl.coupon_id
        where cp.store_id = ${storeId}
      )
      select
        (select coalesce(sum(total_quantity), 0) from promotions.coupons
           where store_id = ${storeId} and status = 'active') as released,
        (select count(*) from store_claims where claimed_at >= ${start}) as claimed,
        (select count(*) from store_claims where status = 'active' and expires_at > now()) as waiting,
        (select count(*) from store_claims where redeemed_at >= ${start}) as redeemed,
        (select count(*) from store_claims
           where (status = 'expired' or (status = 'active' and expires_at <= now()))
             and expires_at >= ${start}) as returned,
        (select json_agg(json_build_object('hour', h, 'count', coalesce(n, 0)) order by h)
           from generate_series(0, 23) h
           left join (
             select extract(hour from redeemed_at at time zone 'America/Sao_Paulo')::int as hour,
                    count(*) as n
             from store_claims where redeemed_at >= ${start} group by 1
           ) per_hour on per_hour.hour = h) as by_hour,
        coalesce((select json_agg(json_build_object(
                    'code', code, 'couponTitle', title,
                    'redeemedAt', to_char(redeemed_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
                    order by redeemed_at desc)
                  from (select code, title, redeemed_at from store_claims
                        where redeemed_at is not null order by redeemed_at desc limit 10) last_ten),
                 '[]'::json) as last_redemptions,
        (select count(*) from visitors.store_follows where store_id = ${storeId}) as followers_count,
        (select count(*) from visitors.favorite_stores where store_id = ${storeId}) as favorites_count
    `);
    return {
      period,
      coupons: {
        released: row.released,
        claimed: row.claimed,
        waiting: row.waiting,
        redeemed: row.redeemed,
        returned: row.returned,
      },
      redemptionsByHour: row.by_hour,
      lastRedemptions: row.last_redemptions,
      followersCount: row.followers_count,
      favoritesCount: row.favorites_count,
    };
  }
}

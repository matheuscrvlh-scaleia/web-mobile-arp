import type {
  ClaimStatus,
  Coupon,
  CouponClaim,
  CouponLifecycle,
  CouponReview,
  CouponSort,
  CouponStatus,
  CouponsByPromotionQuery,
  CouponsByPromotionRow,
  CouponTone,
  ListClaimsQuery,
  ListCouponsQuery,
  StoreKind,
} from "@arp/contracts";
import {
  decodeCursor,
  type KeysetPage,
  offsetOf,
  type Page,
  toKeysetPage,
  toPage,
} from "../../../shared/application/pagination";
import type { Clock } from "../../../shared/application/ports/clock";
import { ValidationError } from "../../../shared/domain/errors";
import { BUSINESS_TIME_ZONE } from "../../../shared/domain/time";
import type { Database } from "../../../shared/infra/database/database";
import { type SqlFragment, sql } from "../../../shared/infra/database/sql";
import { storeHasKind } from "../../../shared/infra/database/store-categories";
import { iso, isoOrNull } from "../../../shared/infra/presenters";
import type { ClaimReader } from "../application/lookup-claim.use-case";

interface CouponRow {
  id: string;
  title: string;
  headline: string;
  headline_sub: string | null;
  description: string | null;
  schedule_note: string | null;
  starts_at: Date;
  ends_at: Date | null;
  total_quantity: number;
  redeem_window_hours: number;
  expires_with_promotion: boolean;
  use_until: Date | null;
  tone: CouponTone;
  icon: string;
  image_url: string | null;
  savings_cents: number | null;
  status: CouponStatus;
  weekdays: number[];
  review: CouponReview;
  review_note: string | null;
  created_at: Date;
  updated_at: Date;
  store_id: string;
  store_name: string;
  store_icon: string;
  store_brand_color: string;
  store_kind: StoreKind;
  waiting: number;
  redeemed: number;
  returned: number;
  is_demo: boolean;
  archived_at: Date | null;
  lifecycle: CouponLifecycle;
}

/**
 * Situação que a pessoa vê (couponLifecycleSchema), a partir do status, das
 * datas, do estoque (lateral `st`) e do arquivo. Usada na leitura e no filtro.
 */
function lifecycleSql(now: Date): SqlFragment {
  return sql`(case
    when c.archived_at is not null then 'archived'
    when c.status = 'draft' then 'draft'
    when c.status = 'paused' then 'paused'
    when c.status = 'ended' or c.ends_at <= ${now} or c.use_until <= ${now} then 'ended'
    when c.starts_at > ${now} then 'scheduled'
    when c.total_quantity - st.waiting - st.redeemed <= 0 then 'soldout'
    else 'active'
  end)`;
}

/** Ordem da lista; o id desempata (a ordem não pula quando algo muda de status). */
const COUPON_ORDER: Record<CouponSort, SqlFragment> = {
  "-created": sql`c.created_at desc, c.id desc`,
  created: sql`c.created_at, c.id`,
  "-starts": sql`c.starts_at desc, c.id desc`,
  starts: sql`c.starts_at, c.id`,
  "-ends": sql`c.ends_at desc nulls last, c.id desc`,
  ends: sql`c.ends_at nulls last, c.id`,
  remaining: sql`(c.total_quantity - st.waiting - st.redeemed), c.id`,
  "-remaining": sql`(c.total_quantity - st.waiting - st.redeemed) desc, c.id desc`,
  "-used": sql`st.redeemed desc, c.id desc`,
  used: sql`st.redeemed, c.id`,
  title: sql`public.f_unaccent(lower(c.title)), c.id`,
  "-title": sql`public.f_unaccent(lower(c.title)) desc, c.id desc`,
};

/** Dia de calendário (São Paulo) → instante do começo do dia; `+1` = fim exclusivo. */
const dayStart = (day: string, plusDays = 0) =>
  sql`(${day}::date + ${plusDays}::int)::timestamp at time zone ${BUSINESS_TIME_ZONE}`;

/** Cupom + loja + estoque derivado (uma lateral por cupom, coberta pelo coupon_claims_stock_idx). */
function couponSelect(now: Date, extraColumns: SqlFragment = sql.empty): SqlFragment {
  return sql`
    select c.id, c.title, c.headline, c.headline_sub, c.description, c.schedule_note, c.starts_at,
           c.ends_at, c.total_quantity, c.redeem_window_hours, c.expires_with_promotion, c.use_until, c.tone, c.icon,
           c.image_url, c.savings_cents, c.status, c.weekdays, c.review, c.review_note,
           c.created_at, c.updated_at, c.is_demo, c.archived_at, ${lifecycleSql(now)} as lifecycle,
           s.id as store_id, s.name as store_name, s.icon as store_icon,
           s.brand_color as store_brand_color, cat.kind as store_kind,
           st.waiting, st.redeemed, st.returned ${extraColumns}
    from promotions.coupons c
    join directory.stores s on s.id = c.store_id
    join directory.store_categories cat on cat.id = s.category_id
    cross join lateral (
      select count(*) filter (where cl.status = 'active' and cl.expires_at > ${now}) as waiting,
             count(*) filter (where cl.status = 'redeemed') as redeemed,
             count(*) filter (
               where cl.status = 'expired' or (cl.status = 'active' and cl.expires_at <= ${now})
             ) as returned
      from promotions.coupon_claims cl
      where cl.coupon_id = c.id
    ) st
  `;
}

function toCoupon(r: CouponRow): Coupon {
  return {
    id: r.id,
    store: {
      id: r.store_id,
      name: r.store_name,
      icon: r.store_icon,
      brandColor: r.store_brand_color,
      kind: r.store_kind,
    },
    title: r.title,
    headline: r.headline,
    headlineSub: r.headline_sub,
    description: r.description,
    scheduleNote: r.schedule_note,
    startsAt: iso(r.starts_at),
    endsAt: isoOrNull(r.ends_at),
    totalQuantity: r.total_quantity,
    redeemWindowHours: r.redeem_window_hours,
    expiresWithPromotion: r.expires_with_promotion,
    useUntil: isoOrNull(r.use_until),
    tone: r.tone,
    icon: r.icon,
    imageUrl: r.image_url,
    savingsCents: r.savings_cents,
    status: r.status,
    lifecycle: r.lifecycle,
    archivedAt: isoOrNull(r.archived_at),
    weekdays: r.weekdays,
    review: r.review,
    reviewNote: r.review_note,
    stock: {
      total: r.total_quantity,
      waiting: r.waiting,
      redeemed: r.redeemed,
      returned: r.returned,
      remaining: Math.max(0, r.total_quantity - r.waiting - r.redeemed),
    },
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
    isDemo: r.is_demo,
  };
}

interface ClaimRow {
  id: string;
  code: string;
  status: ClaimStatus;
  claimed_at: Date;
  expires_at: Date;
  redeemed_at: Date | null;
  coupon_id: string;
  coupon_title: string;
  coupon_headline: string;
  coupon_description: string | null;
  coupon_schedule_note: string | null;
  coupon_weekdays: number[];
  store_id: string;
  store_name: string;
  visitor_id: string;
  visitor_name: string;
  redeemed_by_id: string | null;
  redeemed_by_name: string | null;
  is_demo: boolean;
}

/** Ativo vencido aparece como expirado (a unidade já voltou), mesmo antes do job. */
function effectiveStatus(now: Date): SqlFragment {
  return sql`(case when cl.status = 'active' and cl.expires_at <= ${now} then 'expired' else cl.status end)`;
}

function claimSelect(now: Date, extraColumns: SqlFragment = sql.empty): SqlFragment {
  return sql`
    select cl.id, cl.code, ${effectiveStatus(now)} as status, cl.claimed_at, cl.expires_at,
           cl.redeemed_at, c.id as coupon_id, c.title as coupon_title,
           c.headline as coupon_headline, c.description as coupon_description,
           c.schedule_note as coupon_schedule_note, c.weekdays as coupon_weekdays,
           s.id as store_id, s.name as store_name,
           v.id as visitor_id, v.name as visitor_name, v.is_demo,
           u.id as redeemed_by_id, u.name as redeemed_by_name ${extraColumns}
    from promotions.coupon_claims cl
    join promotions.coupons c on c.id = cl.coupon_id
    join directory.stores s on s.id = c.store_id
    join visitors.visitors v on v.id = cl.visitor_id
    left join identity.users u on u.id = cl.redeemed_by
  `;
}

function toCouponClaim(r: ClaimRow): CouponClaim {
  return {
    id: r.id,
    code: r.code,
    status: r.status,
    claimedAt: iso(r.claimed_at),
    expiresAt: iso(r.expires_at),
    redeemedAt: isoOrNull(r.redeemed_at),
    coupon: {
      id: r.coupon_id,
      title: r.coupon_title,
      headline: r.coupon_headline,
      description: r.coupon_description,
      scheduleNote: r.coupon_schedule_note,
      weekdays: r.coupon_weekdays,
    },
    store: { id: r.store_id, name: r.store_name },
    visitor: { id: r.visitor_id, name: r.visitor_name },
    redeemedBy: r.redeemed_by_id ? { id: r.redeemed_by_id, name: r.redeemed_by_name ?? "" } : null,
    isDemo: r.is_demo,
  };
}

/** Leituras de promoções e pegos, já no formato do contrato. */
export class PromotionsQueries implements ClaimReader {
  constructor(
    private readonly db: Database,
    private readonly clock: Clock,
  ) {}

  /** `storeId` já vem com o escopo do lojista aplicado. */
  async listCoupons(query: ListCouponsQuery & { storeId?: string }): Promise<Page<Coupon>> {
    const now = this.clock.now();
    const rows = await this.db.many<CouponRow & { total: number }>(sql`
      ${couponSelect(now, sql`, count(*) over() as total`)}
      ${sql.where([
        query.storeId && sql`c.store_id = ${query.storeId}`,
        query.status && sql`c.status = ${query.status}`,
        query.review && sql`c.review = ${query.review}`,
        query.kind && storeHasKind(query.kind),
        query.q && sql`public.f_unaccent(lower(c.title)) like ${sql.containsPattern(query.q)}`,
        // Sem filtro de situação: tudo menos as arquivadas.
        query.lifecycle
          ? sql`${lifecycleSql(now)} = ${query.lifecycle}`
          : sql`c.archived_at is null`,
      ])}
      order by ${COUPON_ORDER[query.sort ?? "-created"]}
      limit ${query.pageSize} offset ${offsetOf(query)}
    `);
    return toPage(rows, query, toCoupon);
  }

  /**
   * Por promoção no período (dias em São Paulo): pegos, usados, que voltaram
   * e a economia gerada. Só promoções com algum movimento no período.
   * `storeId` já vem com o escopo do lojista aplicado.
   */
  async couponsByPromotion(
    query: CouponsByPromotionQuery & { storeId?: string },
  ): Promise<CouponsByPromotionRow[]> {
    const now = this.clock.now();
    const from = dayStart(query.from);
    const to = dayStart(query.to, 1);
    const returned = sql`(cc.status = 'expired' or (cc.status = 'active' and cc.expires_at <= ${now}))
      and cc.expires_at >= ${from} and cc.expires_at < ${to}`;
    const rows = await this.db.many<
      CouponRow & { claimed: number; used: number; returned_in_period: number }
    >(sql`
      with agg as (
        select cc.coupon_id,
               count(*) filter (where cc.claimed_at >= ${from} and cc.claimed_at < ${to})::int as claimed,
               count(*) filter (where cc.status = 'redeemed' and cc.redeemed_at >= ${from}
                                  and cc.redeemed_at < ${to})::int as used,
               count(*) filter (where ${returned})::int as returned_in_period
        from promotions.coupon_claims cc
        ${query.storeId ? sql`join promotions.coupons sc on sc.id = cc.coupon_id and sc.store_id = ${query.storeId}` : sql.empty}
        where (cc.claimed_at >= ${from} and cc.claimed_at < ${to})
           or (cc.redeemed_at >= ${from} and cc.redeemed_at < ${to})
           or (cc.expires_at >= ${from} and cc.expires_at < ${to})
        group by cc.coupon_id
      )
      ${couponSelect(now, sql`, agg.claimed, agg.used, agg.returned_in_period`)}
      join agg on agg.coupon_id = c.id
      where agg.claimed > 0 or agg.used > 0 or agg.returned_in_period > 0
      order by agg.used desc, agg.claimed desc, c.title, c.id
    `);
    return rows.map((r) => ({
      coupon: { id: r.id, title: r.title, headline: r.headline },
      store: { id: r.store_id, name: r.store_name },
      lifecycle: r.lifecycle,
      total: r.total_quantity,
      claimed: r.claimed,
      used: r.used,
      returned: r.returned_in_period,
      savingsCents: r.savings_cents === null ? null : r.savings_cents * r.used,
    }));
  }

  async getCoupon(id: string): Promise<Coupon | null> {
    const row = await this.db.maybeOne<CouponRow>(
      sql`${couponSelect(this.clock.now())} where c.id = ${id}`,
    );
    return row ? toCoupon(row) : null;
  }

  /**
   * `storeId` já vem com o escopo do lojista aplicado.
   *
   * Em duas etapas: (1) só os ids da página, pelo índice (claimed_at, id),
   * com os joins que os filtros exigem; (2) os detalhes só dessas linhas. A
   * contagem (modo página) é uma consulta enxuta à parte; no modo cursor
   * não há contagem nem offset — custo constante em qualquer profundidade.
   */
  async listClaims(
    query: ListClaimsQuery & { storeId?: string },
  ): Promise<KeysetPage<CouponClaim>> {
    const now = this.clock.now();
    const position = query.cursor ? decodeCursor(query.cursor, 2) : null;
    if (query.cursor && !position) throw ValidationError.field("cursor", "Cursor inválido");

    const needsCoupon = Boolean(query.storeId);
    const needsVisitor = Boolean(query.q);
    const from = sql`
      from promotions.coupon_claims cl
      ${needsCoupon ? sql`join promotions.coupons c on c.id = cl.coupon_id` : sql.empty}
      ${needsVisitor ? sql`join visitors.visitors v on v.id = cl.visitor_id` : sql.empty}
    `;
    const filters = [
      query.couponId && sql`cl.coupon_id = ${query.couponId}`,
      query.storeId && sql`c.store_id = ${query.storeId}`,
      query.visitorId && sql`cl.visitor_id = ${query.visitorId}`,
      query.status && sql`${effectiveStatus(now)} = ${query.status}`,
      query.from && sql`cl.claimed_at >= ${dayStart(query.from)}`,
      query.to && sql`cl.claimed_at < ${dayStart(query.to, 1)}`,
      query.q &&
        sql`(cl.code like ${`%${query.q.toUpperCase().replace(/[\\%_]/g, "")}%`}
             or public.f_unaccent(lower(v.name)) like ${sql.containsPattern(query.q)})`,
    ];
    const keyset =
      position && sql`(cl.claimed_at, cl.id) < (${position[0]}::timestamptz, ${position[1]}::uuid)`;

    const rows = await this.db.many<ClaimRow & { position_at: string }>(sql`
      with page as (
        select cl.id, cl.claimed_at
        ${from}
        ${sql.where([...filters, keyset])}
        order by cl.claimed_at desc, cl.id desc
        limit ${query.pageSize + 1} ${position ? sql.empty : sql`offset ${offsetOf(query)}`}
      )
      ${claimSelect(now, sql`, cl.claimed_at::text as position_at`)}
      join page on page.id = cl.id
      order by page.claimed_at desc, page.id desc
    `);
    const total = position
      ? null
      : (await this.db.one<{ n: number }>(sql`select count(*) as n ${from} ${sql.where(filters)}`))
          .n;
    return toKeysetPage(rows, query, total, (r) => [r.position_at, r.id], toCouponClaim);
  }

  async claimById(id: string): Promise<CouponClaim | null> {
    const row = await this.db.maybeOne<ClaimRow>(
      sql`${claimSelect(this.clock.now())} where cl.id = ${id}`,
    );
    return row ? toCouponClaim(row) : null;
  }

  async claimByCode(code: string): Promise<CouponClaim | null> {
    const row = await this.db.maybeOne<ClaimRow>(
      sql`${claimSelect(this.clock.now())} where cl.code = ${code}`,
    );
    return row ? toCouponClaim(row) : null;
  }
}

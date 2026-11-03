import type {
  ClaimStatus,
  Coupon,
  CouponClaim,
  CouponStatus,
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
import type { Database } from "../../../shared/infra/database/database";
import { type SqlFragment, sql } from "../../../shared/infra/database/sql";
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
  tone: CouponTone;
  icon: string;
  image_url: string | null;
  savings_cents: number | null;
  status: CouponStatus;
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
}

/** Cupom + loja + estoque derivado (uma lateral por cupom, coberta pelo coupon_claims_stock_idx). */
function couponSelect(now: Date, extraColumns: SqlFragment = sql.empty): SqlFragment {
  return sql`
    select c.id, c.title, c.headline, c.headline_sub, c.description, c.schedule_note, c.starts_at,
           c.ends_at, c.total_quantity, c.redeem_window_hours, c.tone, c.icon, c.image_url,
           c.savings_cents, c.status, c.created_at, c.updated_at,
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
    tone: r.tone,
    icon: r.icon,
    imageUrl: r.image_url,
    savingsCents: r.savings_cents,
    status: r.status,
    stock: {
      total: r.total_quantity,
      waiting: r.waiting,
      redeemed: r.redeemed,
      returned: r.returned,
      remaining: Math.max(0, r.total_quantity - r.waiting - r.redeemed),
    },
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
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
  store_id: string;
  store_name: string;
  visitor_id: string;
  visitor_name: string;
  redeemed_by_id: string | null;
  redeemed_by_name: string | null;
}

/** Ativo vencido aparece como expirado (a unidade já voltou), mesmo antes do job. */
function effectiveStatus(now: Date): SqlFragment {
  return sql`(case when cl.status = 'active' and cl.expires_at <= ${now} then 'expired' else cl.status end)`;
}

function claimSelect(now: Date, extraColumns: SqlFragment = sql.empty): SqlFragment {
  return sql`
    select cl.id, cl.code, ${effectiveStatus(now)} as status, cl.claimed_at, cl.expires_at,
           cl.redeemed_at, c.id as coupon_id, c.title as coupon_title,
           c.headline as coupon_headline, s.id as store_id, s.name as store_name,
           v.id as visitor_id, v.name as visitor_name,
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
    coupon: { id: r.coupon_id, title: r.coupon_title, headline: r.coupon_headline },
    store: { id: r.store_id, name: r.store_name },
    visitor: { id: r.visitor_id, name: r.visitor_name },
    redeemedBy: r.redeemed_by_id ? { id: r.redeemed_by_id, name: r.redeemed_by_name ?? "" } : null,
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
        query.kind && sql`cat.kind = ${query.kind}`,
        query.q && sql`public.f_unaccent(lower(c.title)) like ${sql.containsPattern(query.q)}`,
      ])}
      order by c.starts_at desc, c.id desc
      limit ${query.pageSize} offset ${offsetOf(query)}
    `);
    return toPage(rows, query, toCoupon);
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

import type { App } from "@arp/contracts";
import { BUSINESS_TIME_ZONE } from "../../../shared/domain/time";
import type { Database } from "../../../shared/infra/database/database";
import { sql } from "../../../shared/infra/database/sql";
import { iso, isoOrNull } from "../../../shared/infra/presenters";
import type {
  MerchantOverviewReader,
  MerchantOverviewRequest,
} from "../application/get-merchant-overview.use-case";
import { maskClaimCode } from "../domain/merchant";

const TZ = BUSINESS_TIME_ZONE;
const LAST_REDEMPTIONS = 10;

/** Início do dia (São Paulo) como instante. */
const startOf = (date: string) => sql`((${date}::date)::timestamp at time zone ${TZ})`;
/** Início do dia seguinte (São Paulo): fim exclusivo do intervalo. */
const endOf = (date: string) => sql`(((${date}::date) + 1)::timestamp at time zone ${TZ})`;

interface CouponStatsRow {
  id: string;
  title: string;
  headline: string;
  starts_at: Date;
  ends_at: Date | null;
  total_quantity: number;
  claimed: number;
  redeemed: number;
  waiting: number;
  returned: number;
}

type OverviewData = Awaited<ReturnType<MerchantOverviewReader["overview"]>>;

/**
 * Números da loja para o app do lojista. Três consultas numa transação só
 * leitura (mesmo instante, uma conexão do pool):
 * - cupons no ar: coupons_store_id_status_idx + uma lateral por cupom no
 *   coupon_claims_stock_idx (index-only);
 * - usos por hora e últimos usos: a partir dos cupons da loja, pegos
 *   `redeemed` pelo mesmo índice (coupon_id, status, …), com o intervalo em
 *   redeemed_at — não varre os usos das outras lojas.
 */
export class MerchantQueries implements MerchantOverviewReader {
  constructor(private readonly db: Database) {}

  overview(req: MerchantOverviewRequest): Promise<OverviewData> {
    return this.db.transaction(
      async () => ({
        coupons: await this.liveCoupons(req),
        redemptionsByHour: await this.redemptionsByHour(req),
        lastRedemptions: await this.lastRedemptions(req),
      }),
      { isolationLevel: "repeatable read", readOnly: true },
    );
  }

  private async liveCoupons({
    storeId,
    now,
  }: MerchantOverviewRequest): Promise<App.MerchantCouponStats[]> {
    const rows = await this.db.many<CouponStatsRow>(sql`
      select c.id, c.title, c.headline, c.starts_at, c.ends_at, c.total_quantity,
             st.claimed, st.redeemed, st.waiting, st.returned
      from promotions.coupons c
      cross join lateral (
        select count(*) as claimed,
               count(*) filter (where cl.status = 'redeemed') as redeemed,
               count(*) filter (where cl.status = 'active' and cl.expires_at > ${now}) as waiting,
               count(*) filter (
                 where cl.status = 'expired' or (cl.status = 'active' and cl.expires_at <= ${now})
               ) as returned
        from promotions.coupon_claims cl
        where cl.coupon_id = c.id
      ) st
      where c.store_id = ${storeId} and c.status = 'active'
        and c.starts_at <= ${now} and (c.ends_at is null or c.ends_at > ${now})
      order by c.starts_at desc, c.id desc
    `);
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      headline: r.headline,
      startsAt: iso(r.starts_at),
      endsAt: isoOrNull(r.ends_at),
      total: r.total_quantity,
      claimed: r.claimed,
      redeemed: r.redeemed,
      waiting: r.waiting,
      returned: r.returned,
      remaining: Math.max(0, r.total_quantity - r.waiting - r.redeemed),
    }));
  }

  /** Usados da loja no período (status 'redeemed' ⇔ redeemed_at preenchido, pelo CHECK). */
  private storeRedemptions({ storeId, range }: MerchantOverviewRequest) {
    return sql`
      from promotions.coupons c
      join promotions.coupon_claims cc on cc.coupon_id = c.id and cc.status = 'redeemed'
      where c.store_id = ${storeId}
        and cc.redeemed_at >= ${startOf(range.from)} and cc.redeemed_at < ${endOf(range.to)}
    `;
  }

  private redemptionsByHour(
    req: MerchantOverviewRequest,
  ): Promise<OverviewData["redemptionsByHour"]> {
    return this.db.many(sql`
      select h.hour, coalesce(x.n, 0) as count
      from generate_series(0, 23) as h(hour)
      left join (
        select extract(hour from cc.redeemed_at at time zone ${TZ})::int as hour, count(*) as n
        ${this.storeRedemptions(req)}
        group by 1
      ) x on x.hour = h.hour
      order by h.hour
    `);
  }

  private async lastRedemptions(
    req: MerchantOverviewRequest,
  ): Promise<OverviewData["lastRedemptions"]> {
    const rows = await this.db.many<{ code: string; redeemed_at: Date }>(sql`
      select cc.code, cc.redeemed_at
      ${this.storeRedemptions(req)}
      order by cc.redeemed_at desc, cc.id desc
      limit ${LAST_REDEMPTIONS}
    `);
    return rows.map((r) => ({ code: maskClaimCode(r.code), redeemedAt: iso(r.redeemed_at) }));
  }
}

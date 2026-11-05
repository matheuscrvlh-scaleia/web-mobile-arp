import type { DashboardOverview } from "@arp/contracts";
import type { Database } from "../../../shared/infra/database/database";
import { type SqlFragment, sql } from "../../../shared/infra/database/sql";
import type {
  DashboardReader,
  OverviewRequest,
} from "../application/get-dashboard-overview.use-case";
import { redemptionRate } from "../domain/period";
import { metricDetail } from "./dashboard-detail.queries";
import { endOf, startOf, TZ, UPCOMING_EVENT_DAYS } from "./period-sql";

const TOP_LIMIT = 5;
const SEALS_LIMIT = 10;

interface KpiRow {
  visitors_total: number;
  visitors_total_prev: number;
  visitors_new: number;
  visitors_new_prev: number;
  claimed: number;
  claimed_prev: number;
  redeemed: number;
  redeemed_prev: number;
  savings: number;
  savings_prev: number;
  seals: number;
  seals_prev: number;
  active_coupons: number;
  upcoming_events: number;
}

/**
 * Painel com poucas consultas agregadas (sem N+1). Com loja: cupons, usos,
 * economia, selos/QR dos desafios da loja e eventos da loja; visitantes
 * (total e novos) continuam globais — é o tamanho da base do app.
 */
export class DashboardQueries implements DashboardReader {
  constructor(private readonly db: Database) {}

  /**
   * Uma transação só leitura em REPEATABLE READ, consultas em sequência:
   * todos os blocos veem o mesmo instante (números batem entre si) e o painel
   * ocupa UMA conexão do pool — antes eram 7 em paralelo, o que com pool de
   * 10 deixava o app sem conexão durante um carregamento do dashboard. O
   * resultado fica em cache curto (DASHBOARD_CACHE_TTL_SECONDS).
   */
  async overview(req: OverviewRequest): Promise<DashboardOverview> {
    const { kpis, daily, byHour, topStores, topCoupons, seals, scans, demo } =
      await this.db.transaction(
        async () => ({
          kpis: await this.kpis(req),
          daily: await this.daily(req),
          byHour: await this.redemptionsByHour(req),
          topStores: await this.topStores(req),
          topCoupons: await this.topCoupons(req),
          seals: await this.sealsByChallenge(req),
          scans: await this.scanOutcomes(req),
          demo: await this.hasDemoData(),
        }),
        { isolationLevel: "repeatable read", readOnly: true },
      );
    return {
      period: req.period,
      hasDemoData: demo,
      kpis: {
        visitorsTotal: { value: kpis.visitors_total, previous: kpis.visitors_total_prev },
        visitorsNew: { value: kpis.visitors_new, previous: kpis.visitors_new_prev },
        couponsClaimed: { value: kpis.claimed, previous: kpis.claimed_prev },
        couponsRedeemed: { value: kpis.redeemed, previous: kpis.redeemed_prev },
        redemptionRate: {
          value: redemptionRate(kpis.redeemed, kpis.claimed),
          previous: redemptionRate(kpis.redeemed_prev, kpis.claimed_prev),
        },
        sealsAwarded: { value: kpis.seals, previous: kpis.seals_prev },
        savingsCents: { value: kpis.savings, previous: kpis.savings_prev },
        activeCoupons: { value: kpis.active_coupons, previous: null },
        upcomingEvents: { value: kpis.upcoming_events, previous: null },
      },
      daily,
      redemptionsByHour: byHour,
      topStores,
      topCoupons,
      sealsByChallenge: seals,
      scanOutcomes: scans,
    };
  }

  /** De onde vem um indicador (só leitura, mesmo instante entre as consultas). */
  detail(req: Parameters<DashboardReader["detail"]>[0]) {
    return this.db.transaction(() => metricDetail(this.db, req), {
      isolationLevel: "repeatable read",
      readOnly: true,
    });
  }

  private couponStore(storeId: string | null, alias = "c"): SqlFragment {
    return storeId ? sql`and ${sql.identifier(alias)}.store_id = ${storeId}` : sql.empty;
  }

  /** Selos/leituras só dos desafios da loja (quando filtrado). */
  private challengeStore(storeId: string | null, column: SqlFragment): SqlFragment {
    return storeId
      ? sql`and ${column} in (select id from gamification.challenges where store_id = ${storeId})`
      : sql.empty;
  }

  private async kpis({ range, storeId, now }: OverviewRequest): Promise<KpiRow> {
    const curStart = startOf(range.from);
    const curEnd = endOf(range.to);
    const prevStart = startOf(range.previousFrom);
    const inCur = (col: SqlFragment) => sql`${col} >= ${curStart} and ${col} < ${curEnd}`;
    const inPrev = (col: SqlFragment) => sql`${col} >= ${prevStart} and ${col} < ${curStart}`;
    const claimedAt = sql.raw("cc.claimed_at");
    const redeemedAt = sql.raw("cc.redeemed_at");
    const createdAt = sql.raw("v.created_at");
    const earnedAt = sql.raw("e.earned_at");

    return this.db.one<KpiRow>(sql`
      -- Base até o fim do período (index-only no índice de created_at).
      with v as (
        select
          count(*) filter (where ${createdAt} < ${curEnd}) as visitors_total,
          count(*) filter (where ${createdAt} < ${curStart}) as visitors_total_prev,
          count(*) filter (where ${inCur(createdAt)}) as visitors_new,
          count(*) filter (where ${inPrev(createdAt)}) as visitors_new_prev
        from visitors.visitors v
        where ${createdAt} < ${curEnd}
      ),
      -- Pegos e usados em varreduras separadas, cada uma no seu índice de
      -- intervalo (o OR entre as duas colunas virava seq scan da tabela).
      cl as (
        select
          count(*) filter (where ${inCur(claimedAt)}) as claimed,
          count(*) filter (where ${inPrev(claimedAt)}) as claimed_prev
        from promotions.coupon_claims cc
        join promotions.coupons c on c.id = cc.coupon_id
        where cc.claimed_at >= ${prevStart} and cc.claimed_at < ${curEnd}
          ${this.couponStore(storeId)}
      ),
      rd as (
        select
          count(*) filter (where ${inCur(redeemedAt)}) as redeemed,
          count(*) filter (where ${inPrev(redeemedAt)}) as redeemed_prev,
          coalesce(sum(c.savings_cents) filter (where ${inCur(redeemedAt)}), 0) as savings,
          coalesce(sum(c.savings_cents) filter (where ${inPrev(redeemedAt)}), 0) as savings_prev
        from promotions.coupon_claims cc
        join promotions.coupons c on c.id = cc.coupon_id
        where cc.redeemed_at >= ${prevStart} and cc.redeemed_at < ${curEnd}
          ${this.couponStore(storeId)}
      ),
      es as (
        select
          count(*) filter (where ${inCur(earnedAt)}) as seals,
          count(*) filter (where ${inPrev(earnedAt)}) as seals_prev
        from gamification.earned_seals e
        where e.earned_at >= ${prevStart} and e.earned_at < ${curEnd}
          ${this.challengeStore(storeId, sql.raw("e.challenge_id"))}
      )
      select v.*, cl.*, rd.*, es.*,
        (select count(*) from promotions.coupons c
          where c.status = 'active' and c.starts_at <= ${now}
            and (c.ends_at is null or c.ends_at > ${now})
            ${this.couponStore(storeId)}) as active_coupons,
        (select count(*) from agenda.events ev
          where ev.status = 'published'
            and ev.active_period && daterange(${range.today}::date, (${range.today}::date) + ${UPCOMING_EVENT_DAYS}::int, '[]')
            ${storeId ? sql`and ev.store_id = ${storeId}` : sql.empty}) as upcoming_events
      from v, cl, rd, es
    `);
  }

  private daily({ range, storeId }: OverviewRequest): Promise<DashboardOverview["daily"]> {
    const start = startOf(range.from);
    const end = endOf(range.to);
    const localDay = (col: string) => sql`(${sql.raw(col)} at time zone ${TZ})::date`;
    return this.db.many(sql`
      with days as (
        select d::date as day
        from generate_series(${range.from}::date, ${range.to}::date, interval '1 day') d
      ),
      claims as (
        select ${localDay("cc.claimed_at")} as day, count(*) as n
        from promotions.coupon_claims cc
        join promotions.coupons c on c.id = cc.coupon_id
        where cc.claimed_at >= ${start} and cc.claimed_at < ${end} ${this.couponStore(storeId)}
        group by 1
      ),
      redemptions as (
        select ${localDay("cc.redeemed_at")} as day, count(*) as n
        from promotions.coupon_claims cc
        join promotions.coupons c on c.id = cc.coupon_id
        where cc.redeemed_at >= ${start} and cc.redeemed_at < ${end} ${this.couponStore(storeId)}
        group by 1
      ),
      signups as (
        select ${localDay("v.created_at")} as day, count(*) as n
        from visitors.visitors v
        where v.created_at >= ${start} and v.created_at < ${end}
        group by 1
      ),
      seals as (
        select ${localDay("e.earned_at")} as day, count(*) as n
        from gamification.earned_seals e
        where e.earned_at >= ${start} and e.earned_at < ${end}
          ${this.challengeStore(storeId, sql.raw("e.challenge_id"))}
        group by 1
      )
      select to_char(days.day, 'YYYY-MM-DD') as date,
             coalesce(claims.n, 0) as claims,
             coalesce(redemptions.n, 0) as redemptions,
             coalesce(signups.n, 0) as signups,
             coalesce(seals.n, 0) as seals
      from days
      left join claims using (day)
      left join redemptions using (day)
      left join signups using (day)
      left join seals using (day)
      order by days.day
    `);
  }

  private redemptionsByHour({
    range,
    storeId,
  }: OverviewRequest): Promise<DashboardOverview["redemptionsByHour"]> {
    return this.db.many(sql`
      select h.hour, coalesce(x.n, 0) as count
      from generate_series(0, 23) as h(hour)
      left join (
        select extract(hour from cc.redeemed_at at time zone ${TZ})::int as hour, count(*) as n
        from promotions.coupon_claims cc
        join promotions.coupons c on c.id = cc.coupon_id
        where cc.redeemed_at >= ${startOf(range.from)} and cc.redeemed_at < ${endOf(range.to)}
          ${this.couponStore(storeId)}
        group by 1
      ) x on x.hour = h.hour
      order by h.hour
    `);
  }

  /** Pegos ou usados no período, agrupados (pela loja ou pelo cupom). */
  private periodClaims({ range, storeId }: OverviewRequest): SqlFragment {
    const start = startOf(range.from);
    const end = endOf(range.to);
    return sql`
      select c.id as coupon_id, c.title, c.total_quantity, c.store_id, c.is_demo,
             count(*) filter (where cc.claimed_at >= ${start} and cc.claimed_at < ${end}) as claims,
             count(*) filter (where cc.redeemed_at >= ${start} and cc.redeemed_at < ${end}) as redemptions
      from promotions.coupon_claims cc
      join promotions.coupons c on c.id = cc.coupon_id
      where ((cc.claimed_at >= ${start} and cc.claimed_at < ${end})
          or (cc.redeemed_at >= ${start} and cc.redeemed_at < ${end}))
        ${this.couponStore(storeId)}
      group by c.id
    `;
  }

  private async topStores(req: OverviewRequest): Promise<DashboardOverview["topStores"]> {
    const rows = await this.db.many<{
      id: string;
      name: string;
      claims: number;
      redemptions: number;
    }>(sql`
      select s.id, s.name, sum(p.claims)::int as claims, sum(p.redemptions)::int as redemptions
      from (${this.periodClaims(req)}) p
      join directory.stores s on s.id = p.store_id
      group by s.id, s.name
      order by claims desc, redemptions desc, s.name
      limit ${TOP_LIMIT}
    `);
    return rows.map((r) => ({
      store: { id: r.id, name: r.name },
      claims: r.claims,
      redemptions: r.redemptions,
    }));
  }

  private async topCoupons(req: OverviewRequest): Promise<DashboardOverview["topCoupons"]> {
    const rows = await this.db.many<{
      coupon_id: string;
      title: string;
      store_id: string;
      store_name: string;
      claims: number;
      redemptions: number;
      remaining: number;
      is_demo: boolean;
    }>(sql`
      with top as (
        select * from (${this.periodClaims(req)}) p
        order by p.claims desc, p.redemptions desc, p.title
        limit ${TOP_LIMIT}
      )
      select top.coupon_id, top.title, top.store_id, s.name as store_name,
             top.claims, top.redemptions, top.is_demo,
             greatest(top.total_quantity - stock.taken, 0)::int as remaining
      from top
      join directory.stores s on s.id = top.store_id
      cross join lateral (
        select count(*) filter (where cc.status = 'active' and cc.expires_at > ${req.now})
             + count(*) filter (where cc.status = 'redeemed') as taken
        from promotions.coupon_claims cc
        where cc.coupon_id = top.coupon_id
      ) stock
      order by top.claims desc, top.redemptions desc, top.title
    `);
    return rows.map((r) => ({
      coupon: { id: r.coupon_id, title: r.title },
      store: { id: r.store_id, name: r.store_name },
      claims: r.claims,
      redemptions: r.redemptions,
      remaining: r.remaining,
      isDemo: r.is_demo,
    }));
  }

  private async sealsByChallenge({
    range,
    storeId,
  }: OverviewRequest): Promise<DashboardOverview["sealsByChallenge"]> {
    const rows = await this.db.many<{
      challenge_id: string;
      title: string;
      seal_id: string;
      seal_name: string;
      icon: string;
      gradient_from: string;
      gradient_to: string;
      n: number;
    }>(sql`
      select ch.id as challenge_id, ch.title, se.id as seal_id, se.name as seal_name, se.icon,
             se.gradient_from, se.gradient_to, count(*) as n
      from gamification.earned_seals e
      join gamification.challenges ch on ch.id = e.challenge_id
      join gamification.seals se on se.id = e.seal_id
      where e.earned_at >= ${startOf(range.from)} and e.earned_at < ${endOf(range.to)}
        ${storeId ? sql`and ch.store_id = ${storeId}` : sql.empty}
      group by ch.id, ch.title, se.id, se.name, se.icon, se.gradient_from, se.gradient_to
      order by n desc, ch.title
      limit ${SEALS_LIMIT}
    `);
    return rows.map((r) => ({
      challenge: { id: r.challenge_id, title: r.title },
      seal: {
        id: r.seal_id,
        name: r.seal_name,
        icon: r.icon,
        gradientFrom: r.gradient_from,
        gradientTo: r.gradient_to,
      },
      count: r.n,
    }));
  }

  /** Há dados fictícios de demonstração (seed/demo.ts) somando nos números? */
  private async hasDemoData(): Promise<boolean> {
    const row = await this.db.one<{ demo: boolean }>(sql`
      select exists (select 1 from visitors.visitors where is_demo)
          or exists (select 1 from promotions.coupons where is_demo) as demo
    `);
    return row.demo;
  }

  private scanOutcomes({
    range,
    storeId,
  }: OverviewRequest): Promise<DashboardOverview["scanOutcomes"]> {
    return this.db.one(sql`
      select
        count(*) filter (where qs.result = 'awarded') as awarded,
        count(*) filter (where qs.result = 'duplicate') as duplicate,
        count(*) filter (where qs.result = 'expired') as expired,
        count(*) filter (where qs.result = 'invalid') as invalid
      from gamification.qr_scans qs
      where qs.scanned_at >= ${startOf(range.from)} and qs.scanned_at < ${endOf(range.to)}
        ${
          storeId
            ? sql`and qs.qr_code_id in (
                select q.id from gamification.qr_codes q
                join gamification.challenges ch on ch.id = q.challenge_id
                where ch.store_id = ${storeId})`
            : sql.empty
        }
    `);
  }
}

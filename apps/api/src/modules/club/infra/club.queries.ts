import {
  App,
  type CouponsByStoreQuery,
  type CouponsByStoreRow,
  type ListPrizeRedemptionsQuery,
  type Prize,
  type PrizeKind,
  type PrizeRedemption,
  type PrizeRedemptionStatus,
  type RankingEntry,
  type RedemptionVisitor,
  type SealsReportQuery,
  type SealsReportRow,
} from "@arp/contracts";
import { offsetOf, type Page, toPage } from "../../../shared/application/pagination";
import { BUSINESS_TIME_ZONE } from "../../../shared/domain/time";
import {
  cycleStartSql,
  earnedInCycleSql,
  trevosValidUntil,
  visitorPointsSql,
} from "../../../shared/infra/database/club-points";
import type { Database } from "../../../shared/infra/database/database";
import { sql } from "../../../shared/infra/database/sql";
import { iso, isoOrNull } from "../../../shared/infra/presenters";
import { liveCampaignId } from "../../app-api/infra/fragments";

const RANKING_TOP = 10;
const REDEMPTION_VISITORS_LIMIT = 8;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface PrizeRow {
  id: string;
  name: string;
  description: string;
  kind: PrizeKind;
  points: number;
  stock: number;
  image_url: string | null;
  pickup_rules: string;
  active: boolean;
  sort_order: number;
  is_demo: boolean;
}

const PRIZE_COLUMNS = sql.raw(
  "p.id, p.name, p.description, p.kind, p.points, p.stock, p.image_url, p.pickup_rules, p.active, p.sort_order, p.is_demo",
);

/** Trevos de quem ganhou algum no período que vale (a lojinha e o ranking partem daqui). */
const pointsCte = (now: Date) => sql`
  pts as (
    select v.id, v.ranking_nickname, ${visitorPointsSql(sql`v.id`, now)} as total
    from visitors.visitors v
    where v.status = 'active'
      and exists (select 1 from gamification.earned_seals es
                  where es.visitor_id = v.id and es.earned_at >= ${cycleStartSql(now)})
  )
`;

interface RedemptionRow {
  id: string;
  code: string;
  prize_id: string;
  prize_name: string;
  prize_image_url: string | null;
  points: number;
  status: PrizeRedemptionStatus;
  created_at: Date;
  expires_at: Date | null;
  delivered_at: Date | null;
}

const toClubRedemption = (r: RedemptionRow): App.ClubRedemption => ({
  id: r.id,
  code: r.code,
  prize: { id: r.prize_id, name: r.prize_name, imageUrl: r.prize_image_url },
  points: r.points,
  status: r.status,
  createdAt: iso(r.created_at),
  expiresAt: isoOrNull(r.expires_at),
  deliveredAt: isoOrNull(r.delivered_at),
});

const REDEMPTION_SELECT = sql`
  select pr.id, pr.code, p.id as prize_id, p.name as prize_name, p.image_url as prize_image_url,
         pr.points, pr.status, pr.created_at, pr.expires_at, pr.delivered_at
  from gamification.prize_redemptions pr
  join gamification.prizes p on p.id = pr.prize_id
`;

export class ClubQueries {
  constructor(private readonly db: Database) {}

  /* Painel ------------------------------------------------------------- */

  /** Prêmios com quantos já trocaram e quantos estão perto (para a ARP comprar). */
  async prizes(now: Date, id?: string): Promise<Prize[]> {
    const rows = await this.db.many<
      PrizeRow & { redeemed_count: number; visitors_enough: number; visitors_almost: number }
    >(sql`
      with ${pointsCte(now)}
      select ${PRIZE_COLUMNS},
             (select count(*) from gamification.prize_redemptions pr
              where pr.prize_id = p.id and pr.status <> 'cancelled') as redeemed_count,
             (select count(*) from pts where pts.total >= p.points) as visitors_enough,
             (select count(*) from pts
              where pts.total < p.points and pts.total >= ceil(p.points * 0.8)) as visitors_almost
      from gamification.prizes p
      ${id ? sql`where p.id = ${id}` : sql.empty}
      order by p.sort_order, p.points, p.name
    `);
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      kind: r.kind,
      points: r.points,
      stock: r.stock,
      imageUrl: r.image_url,
      pickupRules: r.pickup_rules,
      active: r.active,
      sortOrder: r.sort_order,
      redeemedCount: r.redeemed_count,
      visitorsEnough: r.visitors_enough,
      visitorsAlmost: r.visitors_almost,
      isDemo: r.is_demo,
    }));
  }

  /** Trocas (paginado); `id` = só aquela troca. */
  async redemptions(query: ListPrizeRedemptionsQuery, id?: string): Promise<Page<PrizeRedemption>> {
    const rows = await this.db.many<{
      id: string;
      code: string;
      prize_id: string;
      prize_name: string;
      visitor_id: string;
      visitor_name: string;
      points: number;
      status: PrizeRedemptionStatus;
      created_at: Date;
      expires_at: Date | null;
      delivered_at: Date | null;
      delivered_by_id: string | null;
      delivered_by_name: string | null;
      cancelled_at: Date | null;
      is_demo: boolean;
      total: number;
    }>(sql`
      select pr.id, pr.code, p.id as prize_id, p.name as prize_name, v.id as visitor_id,
             v.name as visitor_name, pr.points, pr.status, pr.created_at, pr.expires_at, pr.delivered_at,
             u.id as delivered_by_id, u.name as delivered_by_name, pr.cancelled_at, v.is_demo,
             count(*) over() as total
      from gamification.prize_redemptions pr
      join gamification.prizes p on p.id = pr.prize_id
      join visitors.visitors v on v.id = pr.visitor_id
      left join identity.users u on u.id = pr.delivered_by
      ${sql.where([
        id ? sql`pr.id = ${id}` : null,
        query.status ? sql`pr.status = ${query.status}` : null,
        query.q
          ? sql`(pr.code = ${query.q.replace(/[\s-]/g, "").toUpperCase()}
                 or public.f_unaccent(lower(v.name)) like ${sql.containsPattern(query.q)})`
          : null,
      ])}
      order by pr.created_at desc, pr.id desc
      limit ${query.pageSize} offset ${offsetOf(query)}
    `);
    return toPage(rows, query, (r) => ({
      id: r.id,
      code: r.code,
      prize: { id: r.prize_id, name: r.prize_name },
      visitor: { id: r.visitor_id, name: r.visitor_name },
      points: r.points,
      status: r.status,
      createdAt: iso(r.created_at),
      expiresAt: isoOrNull(r.expires_at),
      deliveredAt: isoOrNull(r.delivered_at),
      deliveredBy: r.delivered_by_id
        ? { id: r.delivered_by_id, name: r.delivered_by_name ?? "" }
        : null,
      cancelledAt: isoOrNull(r.cancelled_at),
      isDemo: r.is_demo,
    }));
  }

  /** Balcão: acha o visitante por nome, e-mail ou telefone e mostra o saldo. */
  async redemptionVisitors(q: string, now: Date): Promise<RedemptionVisitor[]> {
    const digits = q.replace(/\D/g, "");
    // O id vem do "Trocar pontos" no detalhe do visitante (/clube/trocar?visitante=<id>).
    const byId = UUID_RE.test(q);
    const rows = await this.db.many<{
      id: string;
      name: string;
      email: string;
      phone: string | null;
      avatar_url: string | null;
      status: string;
      points: number;
    }>(sql`
      select v.id, v.name, v.email, v.phone, v.avatar_url, v.status,
             ${visitorPointsSql(sql`v.id`, now)} as points
      from visitors.visitors v
      where ${
        byId
          ? sql`v.id = ${q}`
          : sql`public.f_unaccent(lower(v.name)) like ${sql.containsPattern(q)}
         or lower(v.email) like ${sql.containsPattern(q)}`
      }
         ${
           !byId && digits.length >= 4
             ? sql`or regexp_replace(coalesce(v.phone, ''), '[^0-9]', '', 'g') like ${`%${digits}%`}`
             : sql.empty
         }
      order by v.name, v.id
      limit ${REDEMPTION_VISITORS_LIMIT}
    `);
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      phone: r.phone,
      avatarUrl: r.avatar_url,
      blocked: r.status !== "active",
      points: r.points,
    }));
  }

  /** Ranking (só apelidos). Com `visitorId`, devolve também a posição dele. */
  async ranking(
    now: Date,
    limit: number,
    visitorId: string | null = null,
  ): Promise<{ top: RankingEntry[]; me: RankingEntry | null }> {
    const rows = await this.db.many<{
      id: string;
      position: number;
      nickname: string;
      points: number;
    }>(sql`
      with ${pointsCte(now)},
      ranked as (
        select id, ranking_nickname as nickname, total as points,
               row_number() over (order by total desc, ranking_nickname) as position
        from pts
        where ranking_nickname is not null and total > 0
      )
      select id, position::int, nickname, points from ranked
      where position <= ${limit} or id = ${visitorId}::uuid
      order by position
    `);
    const entry = ({ position, nickname, points }: (typeof rows)[number]) => ({
      position,
      nickname,
      points,
    });
    const mine = visitorId ? rows.find((r) => r.id === visitorId) : undefined;
    return {
      top: rows.filter((r) => r.position <= limit).map(entry),
      me: mine ? entry(mine) : null,
    };
  }

  /** Selos dados por loja, desafio (produto) e período (dias em São Paulo). */
  async sealsReport(query: SealsReportQuery): Promise<SealsReportRow[]> {
    const rows = await this.db.many<{
      store_id: string | null;
      store_name: string | null;
      challenge_id: string;
      challenge_title: string;
      product: string | null;
      seal_id: string;
      seal_name: string;
      count: number;
    }>(sql`
      select st.id as store_id, st.name as store_name, ch.id as challenge_id,
             ch.title as challenge_title, ch.product, s.id as seal_id, s.name as seal_name,
             count(*) as count
      from gamification.earned_seals es
      join gamification.challenges ch on ch.id = es.challenge_id
      join gamification.seals s on s.id = es.seal_id
      left join directory.stores st on st.id = ch.store_id
      where es.earned_at >= (${query.from}::date)::timestamp at time zone ${BUSINESS_TIME_ZONE}
        and es.earned_at < (${query.to}::date + 1)::timestamp at time zone ${BUSINESS_TIME_ZONE}
        ${query.storeId ? sql`and ch.store_id = ${query.storeId}` : sql.empty}
      group by st.id, st.name, ch.id, ch.title, ch.product, s.id, s.name
      order by st.name nulls last, count desc, ch.title
    `);
    return rows.map((r) => ({
      store: r.store_id ? { id: r.store_id, name: r.store_name ?? "" } : null,
      challenge: { id: r.challenge_id, name: r.challenge_title },
      product: r.product,
      seal: { id: r.seal_id, name: r.seal_name },
      count: r.count,
    }));
  }

  /** Cupons pegos e usados por loja no período (dias em São Paulo). `storeId` já vem com o escopo. */
  async couponsByStore(query: CouponsByStoreQuery): Promise<CouponsByStoreRow[]> {
    const from = sql`(${query.from}::date)::timestamp at time zone ${BUSINESS_TIME_ZONE}`;
    const to = sql`(${query.to}::date + 1)::timestamp at time zone ${BUSINESS_TIME_ZONE}`;
    const rows = await this.db.many<{
      id: string;
      name: string;
      claimed: number;
      used: number;
    }>(sql`
      select st.id, st.name,
             count(*) filter (where cc.claimed_at >= ${from} and cc.claimed_at < ${to})::int as claimed,
             count(*) filter (where cc.status = 'redeemed' and cc.redeemed_at >= ${from}
                                and cc.redeemed_at < ${to})::int as used
      from promotions.coupon_claims cc
      join promotions.coupons c on c.id = cc.coupon_id
      join directory.stores st on st.id = c.store_id
      where ((cc.claimed_at >= ${from} and cc.claimed_at < ${to})
          or (cc.redeemed_at >= ${from} and cc.redeemed_at < ${to}))
        ${query.storeId ? sql`and c.store_id = ${query.storeId}` : sql.empty}
      group by st.id, st.name
      order by used desc, claimed desc, st.name
    `);
    return rows.map((r) => ({
      store: { id: r.id, name: r.name },
      claimed: r.claimed,
      used: r.used,
    }));
  }

  /* App ---------------------------------------------------------------- */

  async club(visitorId: string | null, now: Date): Promise<App.Club> {
    const [prizes, seals, ranking, me, pending] = await Promise.all([
      this.db.many<PrizeRow>(sql`
        select ${PRIZE_COLUMNS} from gamification.prizes p
        where p.active and p.stock > 0
        order by p.sort_order, p.points, p.name
      `),
      this.db.many<{
        id: string;
        name: string;
        icon: string;
        gradient_from: string;
        gradient_to: string;
        points: number;
        repeatable: boolean;
        times: number;
        last_earned_at: Date | null;
        has_challenge: boolean;
      }>(sql`
        select s.id, s.name, s.icon, s.gradient_from, s.gradient_to, s.points, s.repeatable,
               count(es.id)::int as times, max(es.earned_at) as last_earned_at,
               exists (select 1 from gamification.challenges ch
                       where ch.seal_id = s.id and ch.status = 'active'
                         and ch.campaign_id = ${liveCampaignId(now)}) as has_challenge
        from gamification.seals s
        left join gamification.earned_seals es
          on es.seal_id = s.id and es.visitor_id = ${visitorId}::uuid
        group by s.id
        -- Selo arquivado sai da vitrine, mas fica no histórico de quem conquistou.
        having s.status = 'active' or count(es.id) > 0
        order by s.sort_order, s.name
      `),
      this.ranking(now, RANKING_TOP, visitorId),
      visitorId
        ? this.db.one<{ total: number; joined: boolean }>(sql`
            select ${visitorPointsSql(sql`${visitorId}::uuid`, now)} as total,
                   (select ranking_nickname is not null from visitors.visitors
                    where id = ${visitorId}) as joined
          `)
        : null,
      visitorId
        ? this.db.many<RedemptionRow>(sql`
            ${REDEMPTION_SELECT}
            where pr.visitor_id = ${visitorId} and pr.status = 'pending' and pr.expires_at > ${now}
            order by pr.created_at desc
          `)
        : Promise.resolve([] as RedemptionRow[]),
    ]);

    const next = me
      ? prizes.filter((p) => p.points > me.total).sort((a, b) => a.points - b.points)[0]
      : undefined;
    return {
      points: me
        ? {
            total: me.total,
            validUntil:
              me.total > 0 ? ((await trevosValidUntil(this.db, now))?.toISOString() ?? null) : null,
            nextPrize: next
              ? {
                  id: next.id,
                  name: next.name,
                  points: next.points,
                  missing: next.points - me.total,
                }
              : null,
          }
        : null,
      seals: seals.map((s) => ({
        seal: {
          id: s.id,
          name: s.name,
          icon: s.icon,
          gradientFrom: s.gradient_from,
          gradientTo: s.gradient_to,
        },
        points: s.points,
        repeatable: s.repeatable,
        state: s.times > 0 ? "active" : "none",
        times: s.times,
        expiresAt: null,
        lastEarnedAt: isoOrNull(s.last_earned_at),
        hasChallenge: s.has_challenge,
      })),
      prizes: prizes.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        kind: p.kind,
        points: p.points,
        stock: p.stock,
        imageUrl: p.image_url,
        pickupRules: p.pickup_rules,
      })),
      pendingRedemptions: pending.map(toClubRedemption),
      ranking: { top: ranking.top, me: ranking.me, joined: me?.joined ?? false },
    };
  }

  /** Extrato de Trevos: conquistas (+) e trocas (−), do mais recente ao mais antigo. */
  async statement(visitorId: string, now: Date): Promise<App.TrevoStatement> {
    const limit = App.TREVO_STATEMENT_LIMIT;
    const [totals, rows] = await Promise.all([
      this.db.one<{ total: number; earned: number }>(sql`
        select ${visitorPointsSql(sql`${visitorId}::uuid`, now)} as total,
               ${earnedInCycleSql(sql`${visitorId}::uuid`, now)}::int as earned
      `),
      this.db.many<{
        id: string;
        kind: App.TrevoEntryKind;
        title: string;
        seal_id: string | null;
        seal_name: string | null;
        seal_icon: string | null;
        gradient_from: string | null;
        gradient_to: string | null;
        points: number;
        at: Date;
        status: PrizeRedemptionStatus | null;
        code: string | null;
      }>(sql`
        (select es.id, 'earned' as kind, ch.title, s.id as seal_id, s.name as seal_name,
                s.icon as seal_icon, s.gradient_from, s.gradient_to, es.points, es.earned_at as at,
                null::text as status, null::text as code
         from gamification.earned_seals es
         join gamification.challenges ch on ch.id = es.challenge_id
         join gamification.seals s on s.id = es.seal_id
         where es.visitor_id = ${visitorId}
         order by es.earned_at desc
         limit ${limit})
        union all
        (select pr.id, 'redeemed', p.name, null, null, null, null, null, -pr.points, pr.created_at,
                pr.status, pr.code
         from gamification.prize_redemptions pr
         join gamification.prizes p on p.id = pr.prize_id
         where pr.visitor_id = ${visitorId}
         order by pr.created_at desc
         limit ${limit})
        order by at desc
        limit ${limit}
      `),
    ]);
    return {
      total: totals.total,
      validUntil:
        totals.total > 0 ? ((await trevosValidUntil(this.db, now))?.toISOString() ?? null) : null,
      earnedThisYear: totals.earned,
      entries: rows.map((r) => ({
        id: r.id,
        kind: r.kind,
        title: r.title,
        seal:
          r.seal_id && r.seal_name && r.seal_icon && r.gradient_from && r.gradient_to
            ? {
                id: r.seal_id,
                name: r.seal_name,
                icon: r.seal_icon,
                gradientFrom: r.gradient_from,
                gradientTo: r.gradient_to,
              }
            : null,
        points: r.points,
        at: iso(r.at),
        status: r.status,
        code: r.code,
      })),
    };
  }

  /** Uma troca do visitante. */
  async myRedemption(id: string, visitorId: string): Promise<App.ClubRedemption | null> {
    const row = await this.db.maybeOne<RedemptionRow>(sql`
      ${REDEMPTION_SELECT} where pr.id = ${id} and pr.visitor_id = ${visitorId}
    `);
    return row ? toClubRedemption(row) : null;
  }
}

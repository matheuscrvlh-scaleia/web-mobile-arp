import type {
  App,
  ListPrizeRedemptionsQuery,
  Prize,
  PrizeKind,
  PrizeRedemption,
  PrizeRedemptionStatus,
  RankingEntry,
  SealsReportQuery,
  SealsReportRow,
} from "@arp/contracts";
import { offsetOf, type Page, toPage } from "../../../shared/application/pagination";
import { BUSINESS_TIME_ZONE } from "../../../shared/domain/time";
import { visitorPointsSql } from "../../../shared/infra/database/club-points";
import type { Database } from "../../../shared/infra/database/database";
import { sql } from "../../../shared/infra/database/sql";
import { iso, isoOrNull } from "../../../shared/infra/presenters";

const RANKING_TOP = 10;

interface PrizeRow {
  id: string;
  name: string;
  description: string;
  kind: PrizeKind;
  points: number;
  stock: number;
  image_url: string | null;
  active: boolean;
  sort_order: number;
}

const PRIZE_COLUMNS = sql.raw(
  "p.id, p.name, p.description, p.kind, p.points, p.stock, p.image_url, p.active, p.sort_order",
);

/** Pontos de quem tem selo valendo (a lojinha e o ranking partem daqui). */
const pointsCte = (now: Date) => sql`
  pts as (
    select v.id, v.ranking_nickname, ${visitorPointsSql(sql`v.id`, now)} as total
    from visitors.visitors v
    where v.status = 'active'
      and exists (select 1 from gamification.earned_seals es
                  where es.visitor_id = v.id and es.expires_at > ${now})
  )
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
      active: r.active,
      sortOrder: r.sort_order,
      redeemedCount: r.redeemed_count,
      visitorsEnough: r.visitors_enough,
      visitorsAlmost: r.visitors_almost,
    }));
  }

  async redemptions(query: ListPrizeRedemptionsQuery): Promise<Page<PrizeRedemption>> {
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
      delivered_at: Date | null;
      total: number;
    }>(sql`
      select pr.id, pr.code, p.id as prize_id, p.name as prize_name, v.id as visitor_id,
             v.name as visitor_name, pr.points, pr.status, pr.created_at, pr.delivered_at,
             count(*) over() as total
      from gamification.prize_redemptions pr
      join gamification.prizes p on p.id = pr.prize_id
      join visitors.visitors v on v.id = pr.visitor_id
      ${sql.where([
        query.status ? sql`pr.status = ${query.status}` : null,
        query.code ? sql`pr.code = ${query.code.toUpperCase()}` : null,
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
      deliveredAt: isoOrNull(r.delivered_at),
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

  /* App ---------------------------------------------------------------- */

  async club(visitorId: string | null, now: Date): Promise<App.Club> {
    const [prizes, seals, ranking, me] = await Promise.all([
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
        active_until: Date | null;
        last_expired: Date | null;
      }>(sql`
        select s.id, s.name, s.icon, s.gradient_from, s.gradient_to, s.points, s.repeatable,
               count(es.id)::int as times,
               max(es.expires_at) filter (where es.expires_at > ${now}) as active_until,
               max(es.expires_at) filter (where es.expires_at <= ${now}) as last_expired
        from gamification.seals s
        left join gamification.earned_seals es
          on es.seal_id = s.id and es.visitor_id = ${visitorId}::uuid
        where s.status = 'active'
        group by s.id
        order by s.sort_order, s.name
      `),
      this.ranking(now, RANKING_TOP, visitorId),
      visitorId
        ? this.db.one<{ total: number; valid_until: Date | null; joined: boolean }>(sql`
            select ${visitorPointsSql(sql`${visitorId}::uuid`, now)} as total,
                   (select min(es.expires_at) from gamification.earned_seals es
                    where es.visitor_id = ${visitorId} and es.expires_at > ${now}) as valid_until,
                   (select ranking_nickname is not null from visitors.visitors
                    where id = ${visitorId}) as joined
          `)
        : null,
    ]);

    const next = me
      ? prizes.filter((p) => p.points > me.total).sort((a, b) => a.points - b.points)[0]
      : undefined;
    return {
      points: me
        ? {
            total: me.total,
            validUntil: isoOrNull(me.valid_until),
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
        state: s.active_until ? "active" : s.times > 0 ? "expired" : "none",
        times: s.times,
        expiresAt: isoOrNull(s.active_until ?? s.last_expired),
      })),
      prizes: prizes.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        kind: p.kind,
        points: p.points,
        stock: p.stock,
        imageUrl: p.image_url,
      })),
      ranking: { top: ranking.top, me: ranking.me, joined: me?.joined ?? false },
    };
  }
}

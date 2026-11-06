import type { PendingItem, PendingKind } from "@arp/contracts";
import type { Database } from "../../../shared/infra/database/database";
import { type SqlFragment, sql } from "../../../shared/infra/database/sql";
import type { PendingReader, PendingRequest } from "../application/get-pending.use-case";
import { TZ } from "./period-sql";

const SAMPLES = 3;
/** Estoque baixo: menos de 10% do total. */
const LOW_STOCK_RATIO = 0.1;
/** "Vencendo": termina nos próximos 3 dias. */
const ENDING_SOON_DAYS = 3;

interface CountRow {
  count: number;
  samples: { id: string; name: string }[];
}

/**
 * Cada pendência é uma consulta pequena (índices de status/review/agenda),
 * numa transação só de leitura e sem cache: aprovar um cupom precisa sumir
 * do contador na hora.
 */
export class PendingQueries implements PendingReader {
  constructor(private readonly db: Database) {}

  pending(req: PendingRequest): Promise<PendingItem[]> {
    return this.db.transaction(
      async () => {
        const out: PendingItem[] = [];
        for (const kind of req.kinds) {
          const row = await this.db.one<CountRow>(this.queryOf(kind, req));
          out.push({ kind, count: row.count, samples: row.samples });
        }
        return out;
      },
      { readOnly: true },
    );
  }

  /** Conta as linhas (id, name, sort) e pega até 3 exemplos. */
  private summarize(rows: SqlFragment): SqlFragment {
    return sql`
      with r as (${rows})
      select (select count(*) from r)::int as count,
             coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name) order by s.sort)
                         from (select id, name, sort from r order by sort limit ${SAMPLES}) s),
                      '[]'::jsonb) as samples
    `;
  }

  private queryOf(kind: PendingKind, { storeId, now }: PendingRequest): SqlFragment {
    const store = storeId ? sql`and c.store_id = ${storeId}` : sql.empty;
    // Cupom no ar agora (mesma regra do KPI "promoções ativas").
    const live = sql`c.status = 'active' and c.review = 'approved' and c.starts_at <= ${now}
      and (c.ends_at is null or c.ends_at > ${now}) ${store}`;
    // Meia-noite (São Paulo) do dia e do mês de `now`, como hora local sem fuso.
    const today = sql`date_trunc('day', ${now}::timestamptz at time zone ${TZ})`;
    const month = sql`date_trunc('month', ${now}::timestamptz at time zone ${TZ})`;

    switch (kind) {
      case "couponsToReview":
        return this.summarize(sql`
          select c.id, c.title as name, c.created_at as sort
          from promotions.coupons c where c.review = 'pending' ${store}`);
      case "merchantSignups":
        return this.summarize(sql`
          select m.id, m.name || ' · ' || s.name as name, m.created_at as sort
          from identity.merchant_signups m join directory.stores s on s.id = m.store_id
          where m.status = 'pending'`);
      case "couponsLowStock":
        return this.summarize(sql`
          select c.id, c.title as name, st.left_ratio as sort
          from promotions.coupons c
          cross join lateral (
            select (c.total_quantity
                     - count(*) filter (where cl.status = 'active' and cl.expires_at > ${now})
                     - count(*) filter (where cl.status = 'redeemed'))::numeric
                   / c.total_quantity as left_ratio
            from promotions.coupon_claims cl where cl.coupon_id = c.id
          ) st
          where ${live} and st.left_ratio < ${LOW_STOCK_RATIO}`);
      case "couponsEndingSoon":
        return this.summarize(sql`
          select c.id, c.title as name, c.ends_at as sort
          from promotions.coupons c
          where ${live}
            and c.ends_at <= ${now}::timestamptz + make_interval(days => ${ENDING_SOON_DAYS})`);
      case "campaignWithoutChallenges":
        return this.summarize(sql`
          select ca.id, ca.name, ca.starts_at as sort
          from gamification.campaigns ca
          where ca.status = 'published' and ca.starts_at <= ${now} and ca.ends_at > ${now}
            and not exists (select 1 from gamification.challenges ch
                             where ch.campaign_id = ca.id and ch.status = 'active')`);
      case "nextMonthWithoutCampaign":
        // Uma linha (o mês, YYYY-MM) quando nenhuma campanha não arquivada toca o mês que vem.
        return this.summarize(sql`
          select gen_random_uuid() as id, to_char(m.start at time zone ${TZ}, 'YYYY-MM') as name,
                 0 as sort
          from (select (${month} + interval '1 month') at time zone ${TZ} as start,
                       (${month} + interval '2 months') at time zone ${TZ} as stop) m
          where not exists (select 1 from gamification.campaigns ca
                             where ca.status <> 'archived'
                               and ca.starts_at < m.stop and ca.ends_at > m.start)`);
      case "notificationsToday":
        return this.summarize(sql`
          select n.id, n.title as name, n.scheduled_at as sort
          from marketing.push_notifications n
          where n.status = 'scheduled'
            and n.scheduled_at >= ${today} at time zone ${TZ}
            and n.scheduled_at < (${today} + interval '1 day') at time zone ${TZ}`);
      case "prizesOutOfStock":
        return this.summarize(sql`
          select p.id, p.name, p.sort_order as sort
          from gamification.prizes p where p.active and p.stock = 0`);
    }
  }
}

import type { DashboardDetailTable, DashboardMetric, DetailColumnKind } from "@arp/contracts";
import type { Database } from "../../../shared/infra/database/database";
import { sql } from "../../../shared/infra/database/sql";
import type { OverviewRequest } from "../application/get-dashboard-overview.use-case";
import { redemptionRate } from "../domain/period";
import { endOf, startOf, TZ, UPCOMING_EVENT_DAYS, visitorBase } from "./period-sql";

// Linhas do modal "de onde vem este número" do dashboard. Cada indicador usa
// o MESMO filtro do cartão (janela, loja, status), para a soma das linhas
// bater com o número grande. Só agregados e nomes de promoção, loja,
// desafio e evento: nenhum dado pessoal de visitante.

type Request = OverviewRequest & { metric: DashboardMetric };
type Cell = string | number | null;

const table = (
  title: string,
  columns: [string, DetailColumnKind][],
  rows: { id: string; cells: Cell[] }[],
): DashboardDetailTable => ({
  title,
  columns: columns.map(([t, kind]) => ({ title: t, kind })),
  rows,
});

interface CouponRow {
  id: string;
  title: string;
  store_id: string;
  store_name: string;
  savings_cents: number | null;
  claims: number;
  redemptions: number;
}

/** Pegos e usados no período, por promoção (o que forma os 4 cartões de cupom). */
function couponsInPeriod(db: Database, { range, storeId }: Request) {
  const start = startOf(range.from);
  const end = endOf(range.to);
  return db.many<CouponRow>(sql`
    select c.id, c.title, c.store_id, s.name as store_name, c.savings_cents,
           count(*) filter (where cc.claimed_at >= ${start} and cc.claimed_at < ${end})::int as claims,
           count(*) filter (where cc.redeemed_at >= ${start} and cc.redeemed_at < ${end})::int as redemptions
    from promotions.coupon_claims cc
    join promotions.coupons c on c.id = cc.coupon_id
    join directory.stores s on s.id = c.store_id
    where ((cc.claimed_at >= ${start} and cc.claimed_at < ${end})
        or (cc.redeemed_at >= ${start} and cc.redeemed_at < ${end}))
      ${storeId ? sql`and c.store_id = ${storeId}` : sql.empty}
    group by c.id, s.name
  `);
}

/** Soma por loja (só sem filtro de loja: com filtro seria uma linha só). */
function byStore(
  rows: CouponRow[],
  storeId: string | null,
  title: string,
  pick: (r: CouponRow) => number,
  valueTitle: string,
  valueKind: DetailColumnKind = "int",
): DashboardDetailTable[] {
  if (storeId) return [];
  const sums = new Map<string, { name: string; value: number }>();
  for (const r of rows) {
    const s = sums.get(r.store_id) ?? { name: r.store_name, value: 0 };
    s.value += pick(r);
    sums.set(r.store_id, s);
  }
  return [
    table(
      title,
      [
        ["Loja", "text"],
        [valueTitle, valueKind],
      ],
      [...sums]
        .filter(([, s]) => s.value > 0)
        .sort(([, a], [, b]) => b.value - a.value)
        .map(([id, s]) => ({ id, cells: [s.name, s.value] })),
    ),
  ];
}

const byDesc = (pick: (r: CouponRow) => number) => (a: CouponRow, b: CouponRow) =>
  pick(b) - pick(a) || a.title.localeCompare(b.title, "pt-BR");

const savingsOf = (r: CouponRow) => r.redemptions * (r.savings_cents ?? 0);

export async function metricDetail(db: Database, req: Request): Promise<DashboardDetailTable[]> {
  const { range, storeId, now } = req;
  const start = startOf(range.from);
  const end = endOf(range.to);

  switch (req.metric) {
    case "visitorsTotal": {
      const rows = await db.many<{ month: string; n: number; total: number }>(sql`
        with m as (
          select to_char(date_trunc('month', v.created_at at time zone ${TZ}), 'YYYY-MM') as month,
                 count(*)::int as n
          from ${visitorBase(storeId)} v
          where v.created_at < ${end}
          group by 1
        )
        select month, n, (sum(n) over (order by month))::int as total
        from m order by month desc
      `);
      return [
        table(
          storeId ? "Clientes novos da loja por mês" : "Cadastros por mês",
          [
            ["Mês", "month"],
            ["Novos no mês", "int"],
            ["Total até o mês", "int"],
          ],
          rows.map((r) => ({ id: r.month, cells: [r.month, r.n, r.total] })),
        ),
      ];
    }

    case "visitorsNew": {
      const rows = await db.many<{ day: string; n: number }>(sql`
        select to_char(d::date, 'YYYY-MM-DD') as day, coalesce(x.n, 0)::int as n
        from generate_series(${range.from}::date, ${range.to}::date, interval '1 day') d
        left join (
          select (v.created_at at time zone ${TZ})::date as day, count(*) as n
          from ${visitorBase(storeId)} v
          where v.created_at >= ${start} and v.created_at < ${end}
          group by 1
        ) x on x.day = d::date
        order by d desc
      `);
      return [
        table(
          storeId ? "Clientes novos da loja por dia" : "Cadastros por dia",
          [
            ["Dia", "day"],
            [storeId ? "Novos clientes" : "Novos cadastros", "int"],
          ],
          rows.map((r) => ({ id: r.day, cells: [r.day, r.n] })),
        ),
      ];
    }

    case "couponsClaimed": {
      const rows = await couponsInPeriod(db, req);
      const claimed = rows.filter((r) => r.claims > 0).sort(byDesc((r) => r.claims));
      return [
        table(
          "Por promoção",
          [
            ["Promoção", "text"],
            ["Loja", "text"],
            ["Pegos", "int"],
            ["Usados", "int"],
          ],
          claimed.map((r) => ({
            id: r.id,
            cells: [r.title, r.store_name, r.claims, r.redemptions],
          })),
        ),
        ...byStore(rows, storeId, "Por loja", (r) => r.claims, "Pegos"),
      ];
    }

    case "couponsRedeemed": {
      const rows = await couponsInPeriod(db, req);
      const used = rows.filter((r) => r.redemptions > 0).sort(byDesc((r) => r.redemptions));
      return [
        table(
          "Por promoção",
          [
            ["Promoção", "text"],
            ["Loja", "text"],
            ["Usados", "int"],
            ["Economia", "cents"],
          ],
          used.map((r) => ({
            id: r.id,
            cells: [r.title, r.store_name, r.redemptions, savingsOf(r)],
          })),
        ),
        ...byStore(rows, storeId, "Por loja", (r) => r.redemptions, "Usados"),
      ];
    }

    case "redemptionRate": {
      const rows = await couponsInPeriod(db, req);
      return [
        table(
          "Por promoção",
          [
            ["Promoção", "text"],
            ["Loja", "text"],
            ["Pegos", "int"],
            ["Usados", "int"],
            ["Taxa", "percent"],
          ],
          rows.sort(byDesc((r) => r.claims)).map((r) => ({
            id: r.id,
            cells: [
              r.title,
              r.store_name,
              r.claims,
              r.redemptions,
              r.claims > 0 ? redemptionRate(r.redemptions, r.claims) : null,
            ],
          })),
        ),
      ];
    }

    case "savingsCents": {
      const rows = await couponsInPeriod(db, req);
      const used = rows.filter((r) => r.redemptions > 0).sort(byDesc(savingsOf));
      return [
        table(
          "Por promoção",
          [
            ["Promoção", "text"],
            ["Loja", "text"],
            ["Usados", "int"],
            ["Economia por cupom", "cents"],
            ["Economia total", "cents"],
          ],
          used.map((r) => ({
            id: r.id,
            cells: [r.title, r.store_name, r.redemptions, r.savings_cents, savingsOf(r)],
          })),
        ),
        ...byStore(rows, storeId, "Por loja", savingsOf, "Economia", "cents"),
      ];
    }

    case "sealsAwarded": {
      const rows = await db.many<{
        id: string;
        title: string;
        seal: string;
        store: string | null;
        n: number;
      }>(sql`
        select ch.id, ch.title, se.name as seal, s.name as store, count(*)::int as n
        from gamification.earned_seals e
        join gamification.challenges ch on ch.id = e.challenge_id
        join gamification.seals se on se.id = e.seal_id
        left join directory.stores s on s.id = ch.store_id
        where e.earned_at >= ${start} and e.earned_at < ${end}
          ${storeId ? sql`and ch.store_id = ${storeId}` : sql.empty}
        group by ch.id, ch.title, se.id, se.name, s.name
        order by n desc, ch.title
      `);
      return [
        table(
          "Por desafio",
          [
            ["Desafio", "text"],
            ["Selo", "text"],
            ["Loja", "text"],
            ["Selos dados", "int"],
          ],
          rows.map((r) => ({
            id: `${r.id}:${r.seal}`,
            cells: [r.title, r.seal, r.store ?? "ARP", r.n],
          })),
        ),
      ];
    }

    case "activeCoupons": {
      const rows = await db.many<{
        id: string;
        title: string;
        store: string;
        starts: string;
        ends: string | null;
        total: number;
        remaining: number;
      }>(sql`
        select c.id, c.title, s.name as store,
               to_char(c.starts_at at time zone ${TZ}, 'YYYY-MM-DD') as starts,
               to_char(c.ends_at at time zone ${TZ}, 'YYYY-MM-DD') as ends,
               c.total_quantity as total,
               greatest(c.total_quantity - stock.taken, 0)::int as remaining
        from promotions.coupons c
        join directory.stores s on s.id = c.store_id
        cross join lateral (
          select count(*) filter (where cc.status = 'active' and cc.expires_at > ${now})
               + count(*) filter (where cc.status = 'redeemed') as taken
          from promotions.coupon_claims cc
          where cc.coupon_id = c.id
        ) stock
        where c.status = 'active' and c.starts_at <= ${now}
          and (c.ends_at is null or c.ends_at > ${now})
          ${storeId ? sql`and c.store_id = ${storeId}` : sql.empty}
        order by c.ends_at nulls last, c.title
      `);
      return [
        table(
          "Promoções no ar agora",
          [
            ["Promoção", "text"],
            ["Loja", "text"],
            ["Começou", "day"],
            ["Termina", "day"],
            ["Estoque", "int"],
            ["Restam", "int"],
          ],
          rows.map((r) => ({
            id: r.id,
            cells: [r.title, r.store, r.starts, r.ends, r.total, r.remaining],
          })),
        ),
      ];
    }

    case "upcomingEvents": {
      const rows = await db.many<{
        id: string;
        title: string;
        place: string;
        starts_on: string;
        ends_on: string | null;
      }>(sql`
        select ev.id, ev.title, coalesce(s.name, ev.place) as place,
               to_char(ev.starts_on, 'YYYY-MM-DD') as starts_on,
               to_char(ev.ends_on, 'YYYY-MM-DD') as ends_on
        from agenda.events ev
        left join directory.stores s on s.id = ev.store_id
        where ev.status = 'published'
          and ev.active_period && daterange(${range.today}::date, (${range.today}::date) + ${UPCOMING_EVENT_DAYS}::int, '[]')
          ${storeId ? sql`and ev.store_id = ${storeId}` : sql.empty}
        order by ev.starts_on, ev.title
      `);
      return [
        table(
          `Eventos dos próximos ${UPCOMING_EVENT_DAYS} dias`,
          [
            ["Evento", "text"],
            ["Local", "text"],
            ["Início", "day"],
            ["Fim", "day"],
          ],
          rows.map((r) => ({ id: r.id, cells: [r.title, r.place, r.starts_on, r.ends_on] })),
        ),
      ];
    }
  }
}

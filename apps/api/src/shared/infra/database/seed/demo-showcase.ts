import type { Database } from "../database";
import { type SqlFragment, sql } from "../sql";
import type { CampaignInput, CouponInput, PrizeInput } from "./demo-activity";
import { DAY_MS, type DemoClock, HOUR_MS } from "./demo-time";
import type { Random } from "./random";

/*
 * Contas reais de demonstração: visitantes de verdade (da equipe) que ganham
 * atividade fictícia para mostrar o app cheio — selos e pontos no Clube,
 * cupons na carteira, troca na lojinha, eventos com interesse e lojas
 * favoritas. Tudo pende de cupom, campanha, prêmio ou evento fictício, então
 * sai junto quando os dados fictícios são refeitos ou apagados.
 */
export const SHOWCASE_EMAILS = ["lucas@scaleia.ai"] as const;

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export async function insertShowcaseActivity(
  db: Database,
  rng: Random,
  clock: DemoClock,
  input: {
    coupons: CouponInput[];
    campaigns: CampaignInput[];
    prizes: PrizeInput[];
    staffUserId: string | null;
  },
): Promise<number> {
  const visitors = await db.many<{ id: string }>(sql`
    select id from visitors.visitors
    where not is_demo and status = 'active' and lower(email) = any(${[...SHOWCASE_EMAILS]}::text[])
  `);
  const now = clock.now.getTime();
  const at = (days: number, hours = 0) => new Date(now - days * DAY_MS - hours * HOUR_MS);
  const code = (prefix: string) => `${prefix}${rng.string(CODE_ALPHABET, 6)}`;

  for (const { id: visitorId } of visitors) {
    /* Selos: 3 no mês, 4 no anterior, 2 no retrasado (QR com leitura) */
    const seals: SqlFragment[] = [];
    const scans: SqlFragment[] = [];
    const plan: [offset: number, count: number, daysAgo: number[]][] = [
      [0, 3, [4, 2, 0.3]],
      [-1, 4, [38, 33, 29, 27]],
      [-2, 2, [62, 55]],
    ];
    for (const [offset, count, days] of plan) {
      const campaign = input.campaigns.find((c) => c.monthOffset === offset);
      if (!campaign) continue;
      for (const [i, ch] of campaign.challenges.slice(0, count).entries()) {
        const earned = new Date(
          Math.max(campaign.startsAt.getTime() + HOUR_MS, at(days[i] ?? 1).getTime()),
        );
        if (earned.getTime() > now) continue;
        const expires = new Date(earned);
        expires.setUTCMonth(expires.getUTCMonth() + ch.sealValidityMonths);
        const qr = ch.validation === "qr" ? (ch.qrCodeIds[0] ?? null) : null;
        seals.push(sql`(${visitorId}, ${ch.id}, ${ch.sealId}, ${campaign.id}, ${qr}, ${earned},
          ${ch.sealPoints}, ${expires}, ${ch.repeatable})`);
        if (qr) scans.push(sql`(${qr}, ${visitorId}, 'awarded', ${earned})`);
      }
    }
    if (seals.length > 0) {
      await db.query(sql`
        insert into gamification.earned_seals
          (visitor_id, challenge_id, seal_id, campaign_id, qr_code_id, earned_at, points, expires_at, repeatable)
        values ${sql.join(seals)}
      `);
    }
    if (scans.length > 0) {
      await db.query(sql`
        insert into gamification.qr_scans (qr_code_id, visitor_id, result, scanned_at)
        values ${sql.join(scans)}
      `);
    }

    /* Troca na lojinha: o prêmio mais barato, esperando retirada */
    const cheapest = [...input.prizes].sort((a, b) => a.points - b.points)[0];
    if (cheapest) {
      await db.query(sql`
        insert into gamification.prize_redemptions (prize_id, visitor_id, points, code, status, created_at)
        values (${cheapest.id}, ${visitorId}, ${cheapest.points}, ${code("")}, 'pending', ${at(1, 3)})
      `);
    }

    /* Carteira: um cupom ativo, um usado e um que venceu */
    const live = input.coupons.filter((c) => c.live && (!c.endsAt || c.endsAt.getTime() > now));
    const claims: SqlFragment[] = [];
    const [active, used, expired] = live;
    if (active) {
      const claimed = at(0, 2);
      claims.push(sql`(${active.id}, ${visitorId}, ${code("ARP-")}, 'active', ${claimed},
        ${new Date(claimed.getTime() + active.redeemWindowHours * HOUR_MS)}, null, null)`);
    }
    if (used) {
      const claimed = at(5, 4);
      const redeemed = new Date(claimed.getTime() + 40 * 60_000);
      claims.push(sql`(${used.id}, ${visitorId}, ${code("ARP-")}, 'redeemed', ${claimed},
        ${new Date(claimed.getTime() + used.redeemWindowHours * HOUR_MS)}, ${redeemed}, ${input.staffUserId})`);
    }
    if (expired) {
      const claimed = at(12, 6);
      claims.push(sql`(${expired.id}, ${visitorId}, ${code("ARP-")}, 'expired', ${claimed},
        ${new Date(claimed.getTime() + expired.redeemWindowHours * HOUR_MS)}, null, null)`);
    }
    if (claims.length > 0) {
      await db.query(sql`
        insert into promotions.coupon_claims
          (coupon_id, visitor_id, code, status, claimed_at, expires_at, redeemed_at, redeemed_by)
        values ${sql.join(claims)}
      `);
    }

    /* Interesse nos próximos eventos e lojas favoritas/seguidas */
    await db.query(sql`
      insert into agenda.event_interests (visitor_id, event_id, created_at)
      select ${visitorId}, e.id, ${at(1)} from agenda.events e
      where e.is_demo and e.status = 'published'
        and (upper_inf(e.active_period) or upper(e.active_period) > current_date)
      order by lower(e.active_period) limit 3
      on conflict do nothing
    `);
    const storeIds = [...new Set(live.map((c) => c.storeId))].slice(0, 3);
    for (const table of ["visitors.favorite_stores", "visitors.store_follows"]) {
      for (const storeId of storeIds.slice(0, table.endsWith("follows") ? 2 : 3)) {
        await db.query(sql`
          insert into ${sql.identifier(table)} (visitor_id, store_id, created_at)
          values (${visitorId}, ${storeId}, ${at(7)})
          on conflict do nothing
        `);
      }
    }
  }
  return visitors.length;
}

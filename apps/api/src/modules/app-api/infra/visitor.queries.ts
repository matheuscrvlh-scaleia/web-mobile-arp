import type { App } from "@arp/contracts";
import { offsetOf, toCountedPage } from "../../../shared/application/pagination";
import { BUSINESS_TIME_ZONE } from "../../../shared/domain/time";
import { visitorPointsSql } from "../../../shared/infra/database/club-points";
import type { Database } from "../../../shared/infra/database/database";
import { type SqlFragment, sql } from "../../../shared/infra/database/sql";
import { iso } from "../../../shared/infra/presenters";
import { campaignProgress, type Tier } from "../domain/campaign-progress";
import {
  type ChallengeRow,
  type ClaimRow,
  challengeSelect,
  claimSelect,
  liveCampaignId,
  toChallengeItem,
  toClaim,
} from "./fragments";

/** Filtro de cada aba da carteira; espelha walletStatusOf() do domínio. */
const walletFilter = (tab: App.WalletTab, now: Date): SqlFragment => {
  switch (tab) {
    case "active":
      return sql`cc.status = 'active' and cc.expires_at > ${now}`;
    case "used":
      return sql`cc.status = 'redeemed'`;
    case "expired":
      return sql`(cc.status = 'expired' or (cc.status = 'active' and cc.expires_at <= ${now}))`;
  }
};

const walletOrder: Record<App.WalletTab, SqlFragment> = {
  active: sql`cc.expires_at asc, cc.id`,
  used: sql`cc.redeemed_at desc, cc.id`,
  expired: sql`cc.expires_at desc, cc.id`,
};

/** Perfil, resumo do mês, carteira e desafios do visitante logado. */
export class VisitorQueries {
  constructor(private readonly db: Database) {}

  async profile(visitorId: string): Promise<App.VisitorProfile | null> {
    const row = await this.db.maybeOne<{
      id: string;
      name: string;
      email: string;
      phone: string | null;
      avatar_url: string | null;
      marketing_opt_in: boolean;
      created_at: Date;
    }>(sql`
      select id, name, email, phone, avatar_url, marketing_opt_in, created_at
      from visitors.visitors where id = ${visitorId}
    `);
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      avatarUrl: row.avatar_url,
      marketingOptIn: row.marketing_opt_in,
      createdAt: iso(row.created_at),
    };
  }

  async monthSummary(visitorId: string, now: Date): Promise<App.MonthSummary> {
    const row = await this.db.one<{
      seals_earned: number;
      seals_total: number;
      active_claims: number;
      savings_month: number;
      savings_total: number;
      club_points: number;
    }>(sql`
      with live as (select ${liveCampaignId(now)} as id),
           month_start as (
             select date_trunc('month', ${now}::timestamptz at time zone ${BUSINESS_TIME_ZONE})
                    at time zone ${BUSINESS_TIME_ZONE} as at
           )
      select
        ${visitorPointsSql(sql`${visitorId}::uuid`, now)} as club_points,
        (select count(distinct es.challenge_id) from gamification.earned_seals es
         where es.visitor_id = ${visitorId} and es.campaign_id = (select id from live)) as seals_earned,
        (select count(*) from gamification.challenges ch
         where ch.status = 'active' and ch.campaign_id = (select id from live)) as seals_total,
        (select count(*) from promotions.coupon_claims cc
         where cc.visitor_id = ${visitorId} and cc.status = 'active' and cc.expires_at > ${now}) as active_claims,
        (select coalesce(sum(c.savings_cents), 0) from promotions.coupon_claims cc
         join promotions.coupons c on c.id = cc.coupon_id
         where cc.visitor_id = ${visitorId} and cc.status = 'redeemed'
           and cc.redeemed_at >= (select at from month_start)) as savings_month,
        (select coalesce(sum(c.savings_cents), 0) from promotions.coupon_claims cc
         join promotions.coupons c on c.id = cc.coupon_id
         where cc.visitor_id = ${visitorId} and cc.status = 'redeemed') as savings_total
    `);
    return {
      sealsEarned: row.seals_earned,
      sealsTotal: row.seals_total,
      activeClaims: row.active_claims,
      savingsMonthCents: row.savings_month,
      savingsTotalCents: row.savings_total,
      clubPoints: row.club_points,
    };
  }

  async wallet(visitorId: string, query: App.WalletQuery, now: Date): Promise<App.Wallet> {
    const counts = await this.db.one<{ active: number; used: number; expired: number }>(sql`
      select count(*) filter (where ${walletFilter("active", now)}) as active,
             count(*) filter (where ${walletFilter("used", now)}) as used,
             count(*) filter (where ${walletFilter("expired", now)}) as expired
      from promotions.coupon_claims cc
      where cc.visitor_id = ${visitorId}
    `);
    const rows = await this.db.many<ClaimRow>(sql`
      ${claimSelect}
      where cc.visitor_id = ${visitorId} and ${walletFilter(query.tab, now)}
      order by ${walletOrder[query.tab]}
      limit ${query.pageSize} offset ${offsetOf(query)}
    `);
    const page = toCountedPage(rows, query, counts[query.tab], (r) => toClaim(r, now));
    return { ...page, counts };
  }

  /** Desafios da campanha no ar com o progresso do visitante (anônimo: nada ganho). */
  async challenges(visitorId: string | null, now: Date): Promise<App.Challenges> {
    const campaign = await this.db.maybeOne<{
      id: string;
      name: string;
      description: string | null;
      starts_at: Date;
      ends_at: Date;
    }>(sql`
      select id, name, description, starts_at, ends_at
      from gamification.campaigns where id = ${liveCampaignId(now)}
    `);
    if (!campaign) {
      return { campaign: null, challenges: [], progress: campaignProgress(0, 0, []) };
    }
    const rows = await this.db.many<ChallengeRow>(sql`
      ${challengeSelect(visitorId)}
      where ch.campaign_id = ${campaign.id} and ch.status = 'active'
      order by ch.sort_order, ch.title
    `);
    return {
      campaign: {
        id: campaign.id,
        name: campaign.name,
        description: campaign.description,
        startsAt: iso(campaign.starts_at),
        endsAt: iso(campaign.ends_at),
      },
      challenges: rows.map(toChallengeItem),
      progress: await this.progress(visitorId, campaign.id),
    };
  }

  /** Desafios (entre estes) que o visitante já completou, com a data. */
  async earnedChallenges(
    visitorId: string,
    challengeIds: readonly string[],
  ): Promise<Map<string, Date>> {
    if (challengeIds.length === 0) return new Map();
    const rows = await this.db.many<{ challenge_id: string; earned_at: Date }>(sql`
      select challenge_id, earned_at from gamification.earned_seals
      where visitor_id = ${visitorId} and challenge_id = any(${challengeIds}::uuid[])
    `);
    return new Map(rows.map((r) => [r.challenge_id, r.earned_at]));
  }

  async progress(visitorId: string | null, campaignId: string): Promise<App.CampaignProgress> {
    const row = await this.db.one<{ earned: number; total: number; tiers: Tier[] }>(sql`
      select
        (select count(distinct es.challenge_id) from gamification.earned_seals es
         where es.campaign_id = ${campaignId} and es.visitor_id = ${visitorId}::uuid) as earned,
        (select count(*) from gamification.challenges ch
         where ch.campaign_id = ${campaignId} and ch.status = 'active') as total,
        coalesce((
          select jsonb_agg(jsonb_build_object('threshold', t.threshold, 'label', t.label, 'icon', t.icon)
                           order by t.threshold)
          from gamification.reward_tiers t where t.campaign_id = ${campaignId}
        ), '[]'::jsonb) as tiers
    `);
    return campaignProgress(row.earned, row.total, row.tiers);
  }

  /** Resultado de uma leitura de QR que deu selo. */
  async scanResult(visitorId: string, earnedSealId: string): Promise<App.ScanResult | null> {
    const row = await this.db.maybeOne<{
      earned_at: Date;
      points: number;
      total_points: number;
      campaign_id: string;
      campaign_name: string;
      challenge_id: string;
      challenge_title: string;
      seal_id: string;
      seal_name: string;
      seal_icon: string;
      gradient_from: string;
      gradient_to: string;
    }>(sql`
      select es.earned_at, es.points, ${visitorPointsSql(sql`${visitorId}::uuid`, new Date())} as total_points,
             ca.id as campaign_id, ca.name as campaign_name,
             ch.id as challenge_id, ch.title as challenge_title,
             se.id as seal_id, se.name as seal_name, se.icon as seal_icon,
             se.gradient_from, se.gradient_to
      from gamification.earned_seals es
      join gamification.campaigns ca on ca.id = es.campaign_id
      join gamification.challenges ch on ch.id = es.challenge_id
      join gamification.seals se on se.id = es.seal_id
      where es.id = ${earnedSealId} and es.visitor_id = ${visitorId}
    `);
    if (!row) return null;
    return {
      seal: {
        id: row.seal_id,
        name: row.seal_name,
        icon: row.seal_icon,
        gradientFrom: row.gradient_from,
        gradientTo: row.gradient_to,
      },
      challenge: { id: row.challenge_id, title: row.challenge_title },
      campaign: { id: row.campaign_id, name: row.campaign_name },
      earnedAt: iso(row.earned_at),
      progress: await this.progress(visitorId, row.campaign_id),
      points: row.points,
      totalPoints: row.total_points,
    };
  }
}

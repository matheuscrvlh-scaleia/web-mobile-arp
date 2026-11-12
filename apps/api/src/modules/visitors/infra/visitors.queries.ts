import type {
  AuthProvider,
  CouponClaim,
  ListVisitorsQuery,
  PrizeRedemptionStatus,
  SealRef,
  VisitorDetail,
  VisitorStatus,
  VisitorSummary,
} from "@arp/contracts";
import { offsetOf, type Page, toCountedPage } from "../../../shared/application/pagination";
import { visitorPointsSql, yearEndSql } from "../../../shared/infra/database/club-points";
import type { Database } from "../../../shared/infra/database/database";
import { sql } from "../../../shared/infra/database/sql";
import { iso, isoOrNull } from "../../../shared/infra/presenters";

interface SummaryRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  auth_provider: AuthProvider;
  status: VisitorStatus;
  marketing_opt_in: boolean;
  seals_count: number;
  active_claims_count: number;
  redeemed_claims_count: number;
  last_seen_at: Date | null;
  anonymized_at: Date | null;
  is_demo: boolean;
  created_at: Date;
}

interface StoreMini {
  id: string;
  name: string;
  icon: string;
  brandColor: string;
}

/** Linhas montadas com jsonb_build_object: datas chegam como texto. */
interface DetailRow extends SummaryRow {
  blocked_reason: string | null;
  terms_accepted_at: Date | null;
  savings_cents: number;
  favorites: StoreMini[];
  follows: StoreMini[];
  seals: {
    seal: SealRef;
    challengeTitle: string;
    campaignName: string;
    earnedAt: string;
  }[];
  recent_claims: (Omit<CouponClaim, "claimedAt" | "expiresAt" | "redeemedAt"> & {
    claimedAt: string;
    expiresAt: string;
    redeemedAt: string | null;
  })[];
  interests: { event: { id: string; title: string }; createdAt: string }[];
  club_points: number;
  club_expiring_points: number;
  club_next_expiry_at: Date | null;
  club_redemptions: {
    id: string;
    prize: { id: string; name: string };
    points: number;
    status: PrizeRedemptionStatus;
    createdAt: string;
    deliveredAt: string | null;
  }[];
}

/** Contagens por subquery correlacionada (índices por visitor_id cobrem cada uma). */
const SUMMARY_COLUMNS = sql`
  v.id, v.name, v.email, v.phone, v.avatar_url, v.auth_provider, v.status, v.marketing_opt_in,
  v.last_seen_at, v.created_at, v.is_demo, v.anonymized_at,
  (select count(*) from gamification.earned_seals es where es.visitor_id = v.id) as seals_count,
  (select count(*) from promotions.coupon_claims c
    where c.visitor_id = v.id and c.status = 'active' and c.expires_at > now()) as active_claims_count,
  (select count(*) from promotions.coupon_claims c
    where c.visitor_id = v.id and c.status = 'redeemed') as redeemed_claims_count
`;

/**
 * Trevos que vencem: o saldo inteiro vence em 31/12 (o programa é anual).
 * "Vencendo" = saldo, quando faltam 30 dias ou menos para o fim do ano.
 */
const CLUB_EXPIRY_COLUMNS = (now: Date) => sql`
  (case when ${yearEndSql(now)} <= ${now}::timestamptz + interval '30 days'
        then ${visitorPointsSql(sql`v.id`, now)} else 0 end) as club_expiring_points,
  (case when ${visitorPointsSql(sql`v.id`, now)} > 0 then ${yearEndSql(now)} - interval '1 millisecond'
        end) as club_next_expiry_at
`;

const storeMini = (alias: string) =>
  sql.raw(`jsonb_build_object('id', ${alias}.id, 'name', ${alias}.name, 'icon', ${alias}.icon,
    'brandColor', ${alias}.brand_color)`);

function toSummary(r: SummaryRow): VisitorSummary {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    avatarUrl: r.avatar_url,
    authProvider: r.auth_provider,
    status: r.status,
    marketingOptIn: r.marketing_opt_in,
    sealsCount: r.seals_count,
    activeClaimsCount: r.active_claims_count,
    redeemedClaimsCount: r.redeemed_claims_count,
    lastSeenAt: isoOrNull(r.last_seen_at),
    anonymizedAt: isoOrNull(r.anonymized_at),
    createdAt: iso(r.created_at),
    isDemo: r.is_demo,
  };
}

/** Texto de data do jsonb (offset da sessão) → ISO em UTC. */
const isoText = (value: string) => new Date(value).toISOString();

export class VisitorsQueries {
  constructor(private readonly db: Database) {}

  /**
   * Página pelo índice (created_at, id) e contagem à parte: `count(*) over()`
   * materializava a base inteira a cada página (cresce com o app).
   */
  async listVisitors(query: ListVisitorsQuery): Promise<Page<VisitorSummary>> {
    const filters = sql.where([
      query.status && sql`v.status = ${query.status}`,
      query.marketingOptIn && sql`v.marketing_opt_in = ${query.marketingOptIn === "true"}`,
      query.q &&
        sql`(public.f_unaccent(lower(v.name)) like ${sql.containsPattern(query.q)}
             or lower(v.email) like ${sql.containsPattern(query.q)})`,
    ]);
    const rows = await this.db.many<SummaryRow>(sql`
      select ${SUMMARY_COLUMNS}
      from visitors.visitors v
      ${filters}
      order by v.created_at desc, v.id desc
      limit ${query.pageSize} offset ${offsetOf(query)}
    `);
    const { n } = await this.db.one<{ n: number }>(
      sql`select count(*) as n from visitors.visitors v ${filters}`,
    );
    return toCountedPage(rows, query, n, toSummary);
  }

  /** Detalhe com favoritos, lojas seguidas, selos, últimos 20 cupons e interesses — numa consulta. */
  async getVisitor(id: string): Promise<VisitorDetail | null> {
    const now = new Date();
    const row = await this.db.maybeOne<DetailRow>(sql`
      select ${SUMMARY_COLUMNS}, v.blocked_reason, v.terms_accepted_at,
        (select coalesce(sum(cp.savings_cents), 0)
           from promotions.coupon_claims c
           join promotions.coupons cp on cp.id = c.coupon_id
          where c.visitor_id = v.id and c.status = 'redeemed') as savings_cents,
        (select coalesce(jsonb_agg(${storeMini("s")} order by s.name), '[]'::jsonb)
           from visitors.favorite_stores f join directory.stores s on s.id = f.store_id
          where f.visitor_id = v.id) as favorites,
        (select coalesce(jsonb_agg(${storeMini("s")} order by s.name), '[]'::jsonb)
           from visitors.store_follows f join directory.stores s on s.id = f.store_id
          where f.visitor_id = v.id) as follows,
        (select coalesce(jsonb_agg(jsonb_build_object(
                  'seal', jsonb_build_object('id', se.id, 'name', se.name, 'icon', se.icon,
                    'gradientFrom', se.gradient_from, 'gradientTo', se.gradient_to),
                  'challengeTitle', ch.title,
                  'campaignName', ca.name,
                  'earnedAt', es.earned_at) order by es.earned_at desc), '[]'::jsonb)
           from gamification.earned_seals es
           join gamification.seals se on se.id = es.seal_id
           join gamification.challenges ch on ch.id = es.challenge_id
           join gamification.campaigns ca on ca.id = es.campaign_id
          where es.visitor_id = v.id) as seals,
        (select coalesce(jsonb_agg(jsonb_build_object(
                  'id', c.id,
                  'code', c.code,
                  -- Ativo vencido já conta como devolvido (o job só materializa depois).
                  'status', case when c.status = 'active' and c.expires_at <= now()
                                 then 'expired' else c.status end,
                  'claimedAt', c.claimed_at,
                  'expiresAt', c.expires_at,
                  'redeemedAt', c.redeemed_at,
                  'coupon', jsonb_build_object('id', cp.id, 'title', cp.title, 'headline', cp.headline),
                  'store', jsonb_build_object('id', st.id, 'name', st.name),
                  'visitor', jsonb_build_object('id', v.id, 'name', v.name),
                  'redeemedBy', case when u.id is null then null
                                     else jsonb_build_object('id', u.id, 'name', u.name) end
                ) order by c.claimed_at desc), '[]'::jsonb)
           from (select c0.id, c0.code, c0.status, c0.claimed_at, c0.expires_at, c0.redeemed_at,
                         c0.coupon_id, c0.redeemed_by
                    from promotions.coupon_claims c0
                  where c0.visitor_id = v.id order by c0.claimed_at desc limit 20) c
           join promotions.coupons cp on cp.id = c.coupon_id
           join directory.stores st on st.id = cp.store_id
           left join identity.users u on u.id = c.redeemed_by) as recent_claims,
        (select coalesce(jsonb_agg(jsonb_build_object(
                  'event', jsonb_build_object('id', e.id, 'title', e.title),
                  'createdAt', i.created_at) order by i.created_at desc), '[]'::jsonb)
           from agenda.event_interests i join agenda.events e on e.id = i.event_id
          where i.visitor_id = v.id) as interests,
        ${visitorPointsSql(sql`v.id`, now)} as club_points,
        ${CLUB_EXPIRY_COLUMNS(now)},
        (select coalesce(jsonb_agg(jsonb_build_object(
                  'id', pr.id,
                  'prize', jsonb_build_object('id', p.id, 'name', p.name),
                  'points', pr.points,
                  'status', pr.status,
                  'createdAt', pr.created_at,
                  'deliveredAt', pr.delivered_at) order by pr.created_at desc), '[]'::jsonb)
           from (select * from gamification.prize_redemptions pr0
                  where pr0.visitor_id = v.id order by pr0.created_at desc limit 10) pr
           join gamification.prizes p on p.id = pr.prize_id) as club_redemptions
      from visitors.visitors v
      where v.id = ${id}
    `);
    if (!row) return null;
    return {
      ...toSummary(row),
      blockedReason: row.blocked_reason,
      termsAcceptedAt: isoOrNull(row.terms_accepted_at),
      savingsCents: row.savings_cents,
      favorites: row.favorites,
      follows: row.follows,
      seals: row.seals.map((s) => ({ ...s, earnedAt: isoText(s.earnedAt) })),
      recentClaims: row.recent_claims.map((c) => ({
        ...c,
        claimedAt: isoText(c.claimedAt),
        expiresAt: isoText(c.expiresAt),
        redeemedAt: c.redeemedAt ? isoText(c.redeemedAt) : null,
      })),
      interests: row.interests.map((i) => ({ ...i, createdAt: isoText(i.createdAt) })),
      club: {
        points: row.club_points,
        expiringPoints: Math.min(row.club_expiring_points, row.club_points),
        nextExpiryAt: isoOrNull(row.club_next_expiry_at),
        redemptions: row.club_redemptions.map((r) => ({
          ...r,
          createdAt: isoText(r.createdAt),
          deliveredAt: r.deliveredAt ? isoText(r.deliveredAt) : null,
        })),
      },
    };
  }
}

import type {
  Campaign,
  CampaignStatus,
  Challenge,
  ChallengeValidation,
  EarnedSeal,
  ListEarnedSealsQuery,
  QrCode,
  RewardTier,
  Seal,
} from "@arp/contracts";
import { offsetOf, type Page, toPage } from "../../../shared/application/pagination";
import type { Clock } from "../../../shared/application/ports/clock";
import { phaseOf } from "../../../shared/domain/time";
import type { Database } from "../../../shared/infra/database/database";
import { sql } from "../../../shared/infra/database/sql";
import { iso, isoOrNull } from "../../../shared/infra/presenters";
import { qrPayload } from "../domain/qr-code";

/* Selos ------------------------------------------------------------------ */

interface SealRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string;
  gradient_from: string;
  gradient_to: string;
  sort_order: number;
  status: "active" | "archived";
  points: number;
  validity_months: number;
  repeatable: boolean;
  earned_count: number;
  created_at: Date;
  updated_at: Date;
}

const toSeal = (r: SealRow): Seal => ({
  id: r.id,
  slug: r.slug,
  name: r.name,
  description: r.description,
  icon: r.icon,
  gradientFrom: r.gradient_from,
  gradientTo: r.gradient_to,
  sortOrder: r.sort_order,
  status: r.status,
  points: r.points,
  validityMonths: r.validity_months,
  repeatable: r.repeatable,
  earnedCount: r.earned_count,
  createdAt: iso(r.created_at),
  updatedAt: iso(r.updated_at),
});

/* Campanhas -------------------------------------------------------------- */

interface CampaignRow {
  id: string;
  name: string;
  description: string | null;
  starts_at: Date;
  ends_at: Date;
  status: CampaignStatus;
  tiers: RewardTier[];
  challenges_count: number;
  participants_count: number;
  seals_awarded: number;
  created_at: Date;
  updated_at: Date;
}

/* Desafios --------------------------------------------------------------- */

interface ChallengeRow {
  id: string;
  campaign_id: string;
  campaign_name: string;
  seal_id: string;
  seal_name: string;
  seal_icon: string;
  seal_gradient_from: string;
  seal_gradient_to: string;
  title: string;
  how_to: string;
  icon: string;
  validation: ChallengeValidation;
  store_id: string | null;
  store_name: string | null;
  product: string | null;
  event_id: string | null;
  event_title: string | null;
  sort_order: number;
  status: "active" | "inactive";
  completions_count: number;
  qr_codes_count: number;
  created_at: Date;
  updated_at: Date;
}

const CHALLENGE_SELECT = sql`
  select ch.id, ch.campaign_id, c.name as campaign_name,
         s.id as seal_id, s.name as seal_name, s.icon as seal_icon,
         s.gradient_from as seal_gradient_from, s.gradient_to as seal_gradient_to,
         ch.title, ch.how_to, ch.icon, ch.validation, ch.store_id, st.name as store_name, ch.product,
         ch.event_id, e.title as event_title, ch.sort_order, ch.status, ch.created_at, ch.updated_at,
         (select count(*) from gamification.earned_seals es where es.challenge_id = ch.id)
           as completions_count,
         (select count(*) from gamification.qr_codes q where q.challenge_id = ch.id) as qr_codes_count
  from gamification.challenges ch
  join gamification.campaigns c on c.id = ch.campaign_id
  join gamification.seals s on s.id = ch.seal_id
  left join directory.stores st on st.id = ch.store_id
  left join agenda.events e on e.id = ch.event_id
`;

const toChallenge = (r: ChallengeRow): Challenge => ({
  id: r.id,
  campaign: { id: r.campaign_id, name: r.campaign_name },
  seal: {
    id: r.seal_id,
    name: r.seal_name,
    icon: r.seal_icon,
    gradientFrom: r.seal_gradient_from,
    gradientTo: r.seal_gradient_to,
  },
  title: r.title,
  howTo: r.how_to,
  icon: r.icon,
  validation: r.validation,
  store: r.store_id ? { id: r.store_id, name: r.store_name ?? "" } : null,
  product: r.product,
  event: r.event_id ? { id: r.event_id, title: r.event_title ?? "" } : null,
  sortOrder: r.sort_order,
  status: r.status,
  completionsCount: r.completions_count,
  qrCodesCount: r.qr_codes_count,
  createdAt: iso(r.created_at),
  updatedAt: iso(r.updated_at),
});

/* QR Codes --------------------------------------------------------------- */

interface QrRow {
  id: string;
  challenge_id: string;
  token: string;
  label: string;
  valid_from: Date | null;
  valid_until: Date | null;
  status: "active" | "revoked";
  ttl_seconds: number;
  rotating: boolean;
  created_by: string | null;
  created_by_name: string | null;
  awarded: number;
  duplicate: number;
  expired: number;
  created_at: Date;
}

const QR_SELECT = sql`
  select q.id, q.challenge_id, q.token, q.label, q.valid_from, q.valid_until, q.status, q.created_at,
         q.ttl_seconds, q.rotating, q.created_by, u.name as created_by_name,
         sc.awarded, sc.duplicate, sc.expired
  from gamification.qr_codes q
  left join identity.users u on u.id = q.created_by
  cross join lateral (
    select count(*) filter (where s.result = 'awarded') as awarded,
           count(*) filter (where s.result = 'duplicate') as duplicate,
           count(*) filter (where s.result = 'expired') as expired
    from gamification.qr_scans s
    where s.qr_code_id = q.id
  ) sc
`;

const toQrCode = (r: QrRow): QrCode => ({
  id: r.id,
  challengeId: r.challenge_id,
  label: r.label,
  payload: qrPayload(r.token),
  validFrom: isoOrNull(r.valid_from),
  validUntil: isoOrNull(r.valid_until),
  ttlSeconds: r.ttl_seconds,
  rotating: r.rotating,
  createdBy: r.created_by ? { id: r.created_by, name: r.created_by_name ?? "" } : null,
  status: r.status,
  scans: { awarded: r.awarded, duplicate: r.duplicate, expired: r.expired },
  createdAt: iso(r.created_at),
});

/* Selos conquistados ----------------------------------------------------- */

interface EarnedRow {
  id: string;
  seal_id: string;
  seal_name: string;
  seal_icon: string;
  seal_gradient_from: string;
  seal_gradient_to: string;
  challenge_id: string;
  challenge_title: string;
  campaign_id: string;
  campaign_name: string;
  visitor_id: string;
  visitor_name: string;
  earned_at: Date;
}

const toEarnedSeal = (r: EarnedRow): EarnedSeal => ({
  id: r.id,
  seal: {
    id: r.seal_id,
    name: r.seal_name,
    icon: r.seal_icon,
    gradientFrom: r.seal_gradient_from,
    gradientTo: r.seal_gradient_to,
  },
  challenge: { id: r.challenge_id, title: r.challenge_title },
  campaign: { id: r.campaign_id, name: r.campaign_name },
  visitor: { id: r.visitor_id, name: r.visitor_name },
  earnedAt: iso(r.earned_at),
});

/** Leituras de gamificação, já no formato do contrato. */
export class GamificationQueries {
  constructor(
    private readonly db: Database,
    private readonly clock: Clock,
  ) {}

  async listSeals(id?: string): Promise<Seal[]> {
    const rows = await this.db.many<SealRow>(sql`
      select s.id, s.slug, s.name, s.description, s.icon, s.gradient_from, s.gradient_to,
             s.sort_order, s.status, s.points, s.validity_months, s.repeatable,
             s.created_at, s.updated_at,
             (select count(*) from gamification.earned_seals e where e.seal_id = s.id) as earned_count
      from gamification.seals s
      ${sql.where([id && sql`s.id = ${id}`])}
      order by s.status, s.sort_order, s.name
    `);
    return rows.map(toSeal);
  }

  async getSeal(id: string): Promise<Seal | null> {
    return (await this.listSeals(id))[0] ?? null;
  }

  /**
   * Campanhas com faixas. reachedCount = visitantes com selos na campanha
   * ≥ limiar da faixa (agregado por visitante uma vez por campanha).
   */
  async listCampaigns(id?: string): Promise<Campaign[]> {
    const rows = await this.db.many<CampaignRow>(sql`
      select c.id, c.name, c.description, c.starts_at, c.ends_at, c.status, c.created_at,
             c.updated_at,
             (select count(*) from gamification.challenges ch where ch.campaign_id = c.id)
               as challenges_count,
             coalesce(pv.participants, 0) as participants_count,
             coalesce(pv.awarded, 0) as seals_awarded,
             coalesce((
               select jsonb_agg(
                        jsonb_build_object(
                          'id', t.id, 'threshold', t.threshold, 'label', t.label, 'icon', t.icon,
                          'reachedCount',
                          coalesce((select count(*) from unnest(pv.per_visitor) n where n >= t.threshold), 0)
                        ) order by t.threshold)
               from gamification.reward_tiers t
               where t.campaign_id = c.id
             ), '[]'::jsonb) as tiers
      from gamification.campaigns c
      left join lateral (
        select count(*) as participants, sum(v.n) as awarded, array_agg(v.n) as per_visitor
        from (
          select count(*) as n from gamification.earned_seals e
          where e.campaign_id = c.id
          group by e.visitor_id
        ) v
      ) pv on true
      ${sql.where([id && sql`c.id = ${id}`])}
      order by c.starts_at desc, c.id desc
    `);
    const now = this.clock.now();
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      startsAt: iso(r.starts_at),
      endsAt: iso(r.ends_at),
      status: r.status,
      phase: phaseOf(now, r.starts_at, r.ends_at),
      tiers: r.tiers,
      challengesCount: r.challenges_count,
      participantsCount: r.participants_count,
      sealsAwarded: r.seals_awarded,
      createdAt: iso(r.created_at),
      updatedAt: iso(r.updated_at),
    }));
  }

  async getCampaign(id: string): Promise<Campaign | null> {
    return (await this.listCampaigns(id))[0] ?? null;
  }

  async listChallenges(filter: { campaignId?: string; id?: string }): Promise<Challenge[]> {
    const rows = await this.db.many<ChallengeRow>(sql`
      ${CHALLENGE_SELECT}
      ${sql.where([
        filter.campaignId && sql`ch.campaign_id = ${filter.campaignId}`,
        filter.id && sql`ch.id = ${filter.id}`,
      ])}
      order by c.starts_at desc, ch.sort_order, ch.title
    `);
    return rows.map(toChallenge);
  }

  async getChallenge(id: string): Promise<Challenge | null> {
    return (await this.listChallenges({ id }))[0] ?? null;
  }

  /**
   * QR Codes do desafio que esta pessoa gerou (Fase 2: cada um vê os seus).
   * Os antigos, sem autor, aparecem para a equipe da ARP (sem loja).
   */
  async listQrCodes(
    challengeId: string,
    viewer: { id: string; storeId: string | null },
  ): Promise<QrCode[]> {
    const legacy = viewer.storeId === null ? sql`or q.created_by is null` : sql.empty;
    const rows = await this.db.many<QrRow>(sql`
      ${QR_SELECT}
      where q.challenge_id = ${challengeId} and (q.created_by = ${viewer.id} ${legacy})
      order by q.created_at, q.id
    `);
    return rows.map(toQrCode);
  }

  async getQrCode(id: string): Promise<QrCode | null> {
    const row = await this.db.maybeOne<QrRow>(sql`${QR_SELECT} where q.id = ${id}`);
    return row ? toQrCode(row) : null;
  }

  async listEarnedSeals(query: ListEarnedSealsQuery): Promise<Page<EarnedSeal>> {
    const rows = await this.db.many<EarnedRow & { total: number }>(sql`
      select e.id, s.id as seal_id, s.name as seal_name, s.icon as seal_icon,
             s.gradient_from as seal_gradient_from, s.gradient_to as seal_gradient_to,
             ch.id as challenge_id, ch.title as challenge_title,
             c.id as campaign_id, c.name as campaign_name,
             v.id as visitor_id, v.name as visitor_name, e.earned_at,
             count(*) over() as total
      from gamification.earned_seals e
      join gamification.seals s on s.id = e.seal_id
      join gamification.challenges ch on ch.id = e.challenge_id
      join gamification.campaigns c on c.id = e.campaign_id
      join visitors.visitors v on v.id = e.visitor_id
      ${sql.where([
        query.campaignId && sql`e.campaign_id = ${query.campaignId}`,
        query.challengeId && sql`e.challenge_id = ${query.challengeId}`,
        query.visitorId && sql`e.visitor_id = ${query.visitorId}`,
        query.q && sql`public.f_unaccent(lower(v.name)) like ${sql.containsPattern(query.q)}`,
      ])}
      order by e.earned_at desc, e.id desc
      limit ${query.pageSize} offset ${offsetOf(query)}
    `);
    return toPage(rows, query, toEarnedSeal);
  }
}

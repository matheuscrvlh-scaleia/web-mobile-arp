import { ConflictError } from "../../../shared/domain/errors";
import type { Database } from "../../../shared/infra/database/database";
import {
  type ConstraintErrors,
  translateConstraintErrors,
} from "../../../shared/infra/database/errors";
import { escapeLike, sql } from "../../../shared/infra/database/sql";
import {
  Campaign,
  type CampaignStatus,
  type NewCampaign,
  type TierInput,
} from "../domain/campaign";
import {
  Challenge,
  type ChallengeStatus,
  type ChallengeValidation,
  type NewChallenge,
} from "../domain/challenge";
import { QrTokenCollisionError, SealAlreadyEarnedError } from "../domain/errors";
import { type NewQrCode, QrCode, type QrCodeStatus } from "../domain/qr-code";
import type {
  CampaignRepository,
  ChallengeReferences,
  ChallengeRepository,
  QrCodeRepository,
  QrScanContext,
  ScanResult,
  SealAward,
  SealAwardRepository,
  SealRepository,
} from "../domain/repositories";
import { type NewSeal, Seal, type SealStatus } from "../domain/seal";

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
  status: SealStatus;
}

const SEAL_COLUMNS = sql.raw(
  "id, slug, name, description, icon, gradient_from, gradient_to, sort_order, status",
);

const sealToDomain = (r: SealRow) =>
  Seal.restore({
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    icon: r.icon,
    gradientFrom: r.gradient_from,
    gradientTo: r.gradient_to,
    sortOrder: r.sort_order,
    status: r.status,
  });

const SEAL_ERRORS: ConstraintErrors = {
  seals_slug_key: () => new ConflictError("Já existe um selo com esse identificador (slug)"),
};

export class PgSealRepository implements SealRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<Seal | null> {
    const row = await this.db.maybeOne<SealRow>(
      sql`select ${SEAL_COLUMNS} from gamification.seals where id = ${id}`,
    );
    return row ? sealToDomain(row) : null;
  }

  async slugsLike(base: string): Promise<Set<string>> {
    const rows = await this.db.many<{ slug: string }>(sql`
      select slug from gamification.seals
      where slug = ${base} or slug like ${`${escapeLike(base)}-%`}
    `);
    return new Set(rows.map((r) => r.slug));
  }

  async create(d: NewSeal): Promise<Seal> {
    const row = await translateConstraintErrors(
      () =>
        this.db.one<SealRow>(sql`
          insert into gamification.seals
            (slug, name, description, icon, gradient_from, gradient_to, sort_order, status)
          values (${d.slug}, ${d.name}, ${d.description}, ${d.icon}, ${d.gradientFrom},
                  ${d.gradientTo}, ${d.sortOrder}, ${d.status})
          returning ${SEAL_COLUMNS}
        `),
      SEAL_ERRORS,
    );
    return sealToDomain(row);
  }

  async save(seal: Seal): Promise<void> {
    const s = seal.toState();
    await translateConstraintErrors(
      () =>
        this.db.query(sql`
          update gamification.seals
          set slug = ${s.slug}, name = ${s.name}, description = ${s.description}, icon = ${s.icon},
              gradient_from = ${s.gradientFrom}, gradient_to = ${s.gradientTo},
              sort_order = ${s.sortOrder}, status = ${s.status}
          where id = ${s.id}
        `),
      SEAL_ERRORS,
    );
  }
}

/* Campanhas -------------------------------------------------------------- */

interface CampaignRow {
  id: string;
  name: string;
  description: string | null;
  starts_at: Date;
  ends_at: Date;
  status: CampaignStatus;
}

const CAMPAIGN_COLUMNS = sql.raw("id, name, description, starts_at, ends_at, status");

const campaignToDomain = (r: CampaignRow) =>
  Campaign.restore({
    id: r.id,
    name: r.name,
    description: r.description,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    status: r.status,
  });

export class PgCampaignRepository implements CampaignRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<Campaign | null> {
    const row = await this.db.maybeOne<CampaignRow>(
      sql`select ${CAMPAIGN_COLUMNS} from gamification.campaigns where id = ${id}`,
    );
    return row ? campaignToDomain(row) : null;
  }

  async create(d: NewCampaign): Promise<Campaign> {
    const row = await this.db.one<CampaignRow>(sql`
      insert into gamification.campaigns (name, description, starts_at, ends_at, status)
      values (${d.name}, ${d.description}, ${d.startsAt}, ${d.endsAt}, ${d.status})
      returning ${CAMPAIGN_COLUMNS}
    `);
    return campaignToDomain(row);
  }

  async save(campaign: Campaign): Promise<void> {
    const s = campaign.toState();
    await this.db.query(sql`
      update gamification.campaigns
      set name = ${s.name}, description = ${s.description}, starts_at = ${s.startsAt},
          ends_at = ${s.endsAt}, status = ${s.status}
      where id = ${s.id}
    `);
  }

  async replaceTiers(campaignId: string, tiers: readonly TierInput[]): Promise<void> {
    await this.db.query(
      sql`delete from gamification.reward_tiers where campaign_id = ${campaignId}`,
    );
    if (tiers.length === 0) return;
    const values = tiers.map((t) => sql`(${campaignId}, ${t.threshold}, ${t.label}, ${t.icon})`);
    await this.db.query(sql`
      insert into gamification.reward_tiers (campaign_id, threshold, label, icon)
      values ${sql.join(values)}
    `);
  }
}

/* Desafios --------------------------------------------------------------- */

interface ChallengeRow {
  id: string;
  campaign_id: string;
  seal_id: string;
  title: string;
  how_to: string;
  icon: string;
  validation: ChallengeValidation;
  store_id: string | null;
  event_id: string | null;
  sort_order: number;
  status: ChallengeStatus;
}

const CHALLENGE_COLUMNS = sql.raw(
  "id, campaign_id, seal_id, title, how_to, icon, validation, store_id, event_id, sort_order, status",
);

const challengeToDomain = (r: ChallengeRow) =>
  Challenge.restore({
    id: r.id,
    campaignId: r.campaign_id,
    sealId: r.seal_id,
    title: r.title,
    howTo: r.how_to,
    icon: r.icon,
    validation: r.validation,
    storeId: r.store_id,
    eventId: r.event_id,
    sortOrder: r.sort_order,
    status: r.status,
  });

export class PgChallengeRepository implements ChallengeRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<Challenge | null> {
    const row = await this.db.maybeOne<ChallengeRow>(
      sql`select ${CHALLENGE_COLUMNS} from gamification.challenges where id = ${id}`,
    );
    return row ? challengeToDomain(row) : null;
  }

  async create(d: NewChallenge): Promise<Challenge> {
    const row = await this.db.one<ChallengeRow>(sql`
      insert into gamification.challenges
        (campaign_id, seal_id, title, how_to, icon, validation, store_id, event_id, sort_order, status)
      values (${d.campaignId}, ${d.sealId}, ${d.title}, ${d.howTo}, ${d.icon}, ${d.validation},
              ${d.storeId}, ${d.eventId}, ${d.sortOrder}, ${d.status})
      returning ${CHALLENGE_COLUMNS}
    `);
    return challengeToDomain(row);
  }

  async save(challenge: Challenge): Promise<void> {
    const s = challenge.toState();
    await this.db.query(sql`
      update gamification.challenges
      set seal_id = ${s.sealId}, title = ${s.title}, how_to = ${s.howTo}, icon = ${s.icon},
          validation = ${s.validation}, store_id = ${s.storeId}, event_id = ${s.eventId},
          sort_order = ${s.sortOrder}, status = ${s.status}
      where id = ${s.id}
    `);
  }

  async delete(id: string): Promise<void> {
    await this.db.query(sql`delete from gamification.challenges where id = ${id}`);
  }

  async countEarned(challengeId: string): Promise<number> {
    const { n } = await this.db.one<{ n: number }>(
      sql`select count(*) as n from gamification.earned_seals where challenge_id = ${challengeId}`,
    );
    return n;
  }
}

/* QR Codes --------------------------------------------------------------- */

interface QrRow {
  id: string;
  challenge_id: string;
  token: string;
  label: string;
  valid_from: Date | null;
  valid_until: Date | null;
  status: QrCodeStatus;
}

const QR_COLUMNS = sql.raw("id, challenge_id, token, label, valid_from, valid_until, status");

const qrToDomain = (r: QrRow) =>
  QrCode.restore({
    id: r.id,
    challengeId: r.challenge_id,
    token: r.token,
    label: r.label,
    validFrom: r.valid_from,
    validUntil: r.valid_until,
    status: r.status,
  });

export class PgQrCodeRepository implements QrCodeRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<QrCode | null> {
    const row = await this.db.maybeOne<QrRow>(
      sql`select ${QR_COLUMNS} from gamification.qr_codes where id = ${id}`,
    );
    return row ? qrToDomain(row) : null;
  }

  async create(d: NewQrCode): Promise<QrCode> {
    const row = await translateConstraintErrors(
      () =>
        this.db.one<QrRow>(sql`
          insert into gamification.qr_codes
            (challenge_id, token, label, valid_from, valid_until, status)
          values (${d.challengeId}, ${d.token}, ${d.label}, ${d.validFrom}, ${d.validUntil},
                  ${d.status})
          returning ${QR_COLUMNS}
        `),
      { qr_codes_token_key: () => new QrTokenCollisionError() },
    );
    return qrToDomain(row);
  }

  async save(qr: QrCode): Promise<void> {
    const s = qr.toState();
    await this.db.query(sql`
      update gamification.qr_codes
      set label = ${s.label}, valid_from = ${s.validFrom}, valid_until = ${s.validUntil},
          status = ${s.status}
      where id = ${s.id}
    `);
  }
}

/* Leitura de QR e selos conquistados ------------------------------------- */

export class PgSealAwardRepository implements SealAwardRepository {
  constructor(private readonly db: Database) {}

  async findQrContext(token: string): Promise<QrScanContext | null> {
    const r = await this.db.maybeOne<{
      qr_id: string;
      token: string;
      label: string;
      valid_from: Date | null;
      valid_until: Date | null;
      qr_status: QrCodeStatus;
      challenge_id: string;
      seal_id: string;
      title: string;
      how_to: string;
      icon: string;
      validation: ChallengeValidation;
      store_id: string | null;
      event_id: string | null;
      sort_order: number;
      challenge_status: ChallengeStatus;
      campaign_id: string;
      campaign_name: string;
      campaign_description: string | null;
      starts_at: Date;
      ends_at: Date;
      campaign_status: CampaignStatus;
    }>(sql`
      select q.id as qr_id, q.token, q.label, q.valid_from, q.valid_until, q.status as qr_status,
             ch.id as challenge_id, ch.seal_id, ch.title, ch.how_to, ch.icon, ch.validation,
             ch.store_id, ch.event_id, ch.sort_order, ch.status as challenge_status,
             c.id as campaign_id, c.name as campaign_name, c.description as campaign_description,
             c.starts_at, c.ends_at, c.status as campaign_status
      from gamification.qr_codes q
      join gamification.challenges ch on ch.id = q.challenge_id
      join gamification.campaigns c on c.id = ch.campaign_id
      where q.token = ${token}
    `);
    if (!r) return null;
    return {
      qr: qrToDomain({
        id: r.qr_id,
        challenge_id: r.challenge_id,
        token: r.token,
        label: r.label,
        valid_from: r.valid_from,
        valid_until: r.valid_until,
        status: r.qr_status,
      }),
      challenge: challengeToDomain({
        id: r.challenge_id,
        campaign_id: r.campaign_id,
        seal_id: r.seal_id,
        title: r.title,
        how_to: r.how_to,
        icon: r.icon,
        validation: r.validation,
        store_id: r.store_id,
        event_id: r.event_id,
        sort_order: r.sort_order,
        status: r.challenge_status,
      }),
      campaign: campaignToDomain({
        id: r.campaign_id,
        name: r.campaign_name,
        description: r.campaign_description,
        starts_at: r.starts_at,
        ends_at: r.ends_at,
        status: r.campaign_status,
      }),
    };
  }

  hasEarned(visitorId: string, challengeId: string): Promise<boolean> {
    return this.db.exists(sql`
      select 1 from gamification.earned_seals
      where visitor_id = ${visitorId} and challenge_id = ${challengeId}
    `);
  }

  async award(d: SealAward): Promise<string> {
    const { id } = await translateConstraintErrors(
      () =>
        this.db.one<{ id: string }>(sql`
          insert into gamification.earned_seals
            (visitor_id, challenge_id, seal_id, campaign_id, qr_code_id, earned_at)
          values (${d.visitorId}, ${d.challengeId}, ${d.sealId}, ${d.campaignId}, ${d.qrCodeId},
                  ${d.earnedAt})
          returning id
        `),
      { earned_seals_visitor_challenge_key: () => new SealAlreadyEarnedError() },
    );
    return id;
  }

  async recordScan(scan: {
    qrCodeId: string | null;
    visitorId: string;
    result: ScanResult;
    at: Date;
  }): Promise<void> {
    await this.db.query(sql`
      insert into gamification.qr_scans (qr_code_id, visitor_id, result, scanned_at)
      values (${scan.qrCodeId}, ${scan.visitorId}, ${scan.result}, ${scan.at})
    `);
  }
}

/* Referências de outros módulos ------------------------------------------ */

export class PgChallengeReferences implements ChallengeReferences {
  constructor(private readonly db: Database) {}

  storeExists(id: string): Promise<boolean> {
    return this.db.exists(sql`select 1 from directory.stores where id = ${id}`);
  }

  eventExists(id: string): Promise<boolean> {
    return this.db.exists(sql`select 1 from agenda.events where id = ${id}`);
  }
}

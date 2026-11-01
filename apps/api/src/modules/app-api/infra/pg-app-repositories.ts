import { ConflictError } from "../../../shared/domain/errors";
import type { Database } from "../../../shared/infra/database/database";
import { translateConstraintErrors } from "../../../shared/infra/database/errors";
import { sql } from "../../../shared/infra/database/sql";
import type {
  EngagementRepository,
  PushPlatform,
  VisitorAccountRepository,
} from "../domain/repositories";
import {
  type AuthProvider,
  type NewVisitorAccount,
  VisitorAccount,
  type VisitorProfileChanges,
  type VisitorStatus,
} from "../domain/visitor-account";

export interface VisitorRow {
  id: string;
  name: string;
  email: string;
  password_hash: string | null;
  auth_provider: AuthProvider;
  status: VisitorStatus;
}

export const VISITOR_COLUMNS = sql.raw("id, name, email, password_hash, auth_provider, status");

export const visitorToDomain = (r: VisitorRow) =>
  VisitorAccount.restore({
    id: r.id,
    name: r.name,
    email: r.email,
    passwordHash: r.password_hash,
    authProvider: r.auth_provider,
    status: r.status,
  });

export class PgVisitorAccountRepository implements VisitorAccountRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<VisitorAccount | null> {
    const row = await this.db.maybeOne<VisitorRow>(
      sql`select ${VISITOR_COLUMNS} from visitors.visitors where id = ${id}`,
    );
    return row ? visitorToDomain(row) : null;
  }

  async findByEmail(email: string): Promise<VisitorAccount | null> {
    const row = await this.db.maybeOne<VisitorRow>(
      sql`select ${VISITOR_COLUMNS} from visitors.visitors where lower(email) = lower(${email})`,
    );
    return row ? visitorToDomain(row) : null;
  }

  async create(data: NewVisitorAccount): Promise<VisitorAccount> {
    const row = await translateConstraintErrors(
      () =>
        this.db.one<VisitorRow>(sql`
          insert into visitors.visitors
            (name, email, phone, password_hash, auth_provider, marketing_opt_in, terms_accepted_at,
             last_seen_at)
          values
            (${data.name}, ${data.email}, ${data.phone}, ${data.passwordHash}, 'password',
             ${data.marketingOptIn}, ${data.termsAcceptedAt}, ${data.termsAcceptedAt})
          returning ${VISITOR_COLUMNS}
        `),
      { visitors_email_key: () => new ConflictError("E-mail já cadastrado") },
    );
    return visitorToDomain(row);
  }

  async touchLastSeen(id: string, at: Date): Promise<void> {
    await this.db.query(sql`update visitors.visitors set last_seen_at = ${at} where id = ${id}`);
  }

  async updateProfile(id: string, changes: VisitorProfileChanges): Promise<void> {
    const sets = [
      changes.name !== undefined && sql`name = ${changes.name}`,
      changes.phone !== undefined && sql`phone = ${changes.phone}`,
      changes.marketingOptIn !== undefined && sql`marketing_opt_in = ${changes.marketingOptIn}`,
    ].filter((s) => s !== false);
    if (sets.length === 0) return;
    await this.db.query(sql`update visitors.visitors set ${sql.join(sets, ", ")} where id = ${id}`);
  }
}

export class PgEngagementRepository implements EngagementRepository {
  constructor(private readonly db: Database) {}

  isStoreActive(storeId: string): Promise<boolean> {
    return this.db.exists(
      sql`select 1 from directory.stores where id = ${storeId} and status = 'active'`,
    );
  }

  isEventPublished(eventId: string): Promise<boolean> {
    return this.db.exists(
      sql`select 1 from agenda.events where id = ${eventId} and status = 'published'`,
    );
  }

  async setFavorite(visitorId: string, storeId: string, on: boolean): Promise<void> {
    await this.db.query(
      on
        ? sql`insert into visitors.favorite_stores (visitor_id, store_id) values (${visitorId}, ${storeId})
              on conflict do nothing`
        : sql`delete from visitors.favorite_stores where visitor_id = ${visitorId} and store_id = ${storeId}`,
    );
  }

  async setFollow(visitorId: string, storeId: string, on: boolean): Promise<void> {
    await this.db.query(
      on
        ? sql`insert into visitors.store_follows (visitor_id, store_id) values (${visitorId}, ${storeId})
              on conflict do nothing`
        : sql`delete from visitors.store_follows where visitor_id = ${visitorId} and store_id = ${storeId}`,
    );
  }

  async setInterest(visitorId: string, eventId: string, on: boolean): Promise<void> {
    await this.db.query(
      on
        ? sql`insert into agenda.event_interests (visitor_id, event_id) values (${visitorId}, ${eventId})
              on conflict do nothing`
        : sql`delete from agenda.event_interests where visitor_id = ${visitorId} and event_id = ${eventId}`,
    );
  }

  async upsertPushToken(
    visitorId: string,
    token: string,
    platform: PushPlatform,
    at: Date,
  ): Promise<void> {
    await this.db.query(sql`
      insert into visitors.push_tokens (visitor_id, token, platform, last_seen_at)
      values (${visitorId}, ${token}, ${platform}, ${at})
      on conflict (token) do update
        set visitor_id = excluded.visitor_id, platform = excluded.platform,
            last_seen_at = excluded.last_seen_at
    `);
  }

  async removePushToken(token: string, visitorId?: string): Promise<void> {
    await this.db.query(sql`
      delete from visitors.push_tokens
      where token = ${token}
        ${visitorId ? sql`and visitor_id = ${visitorId}` : sql.empty}
    `);
  }
}

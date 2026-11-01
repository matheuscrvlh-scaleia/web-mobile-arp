import { ConflictError } from "../../../shared/domain/errors";
import type { Database } from "../../../shared/infra/database/database";
import { translateConstraintErrors } from "../../../shared/infra/database/errors";
import { sql } from "../../../shared/infra/database/sql";
import type {
  PasswordReset,
  PasswordResetRepository,
  VisitorCredentialsRepository,
} from "../domain/repositories";
import type {
  NewSocialVisitorAccount,
  SocialProvider,
  VisitorAccount,
} from "../domain/visitor-account";
import { VISITOR_COLUMNS, type VisitorRow, visitorToDomain } from "./pg-app-repositories";

export class PgVisitorCredentialsRepository implements VisitorCredentialsRepository {
  constructor(private readonly db: Database) {}

  async findByProviderSubject(
    provider: SocialProvider,
    providerSubject: string,
  ): Promise<VisitorAccount | null> {
    const row = await this.db.maybeOne<VisitorRow>(sql`
      select ${VISITOR_COLUMNS} from visitors.visitors
      where auth_provider = ${provider} and provider_subject = ${providerSubject}
    `);
    return row ? visitorToDomain(row) : null;
  }

  async createSocial(data: NewSocialVisitorAccount): Promise<VisitorAccount> {
    const row = await translateConstraintErrors(
      () =>
        this.db.one<VisitorRow>(sql`
          insert into visitors.visitors
            (name, email, auth_provider, provider_subject, marketing_opt_in, terms_accepted_at,
             last_seen_at)
          values
            (${data.name}, ${data.email}, ${data.provider}, ${data.providerSubject},
             ${data.marketingOptIn}, ${data.termsAcceptedAt}, ${data.termsAcceptedAt})
          returning ${VISITOR_COLUMNS}
        `),
      {
        visitors_email_key: () => new ConflictError("E-mail já cadastrado"),
        visitors_provider_subject_key: () => new ConflictError("Conta já cadastrada"),
      },
    );
    return visitorToDomain(row);
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await this.db.query(
      sql`update visitors.visitors set password_hash = ${passwordHash} where id = ${id}`,
    );
  }
}

interface PasswordResetRow {
  id: string;
  code_hash: string;
  expires_at: Date;
  attempts: number;
}

export class PgPasswordResetRepository implements PasswordResetRepository {
  constructor(private readonly db: Database) {}

  async replace(visitorId: string, codeHash: string, expiresAt: Date): Promise<void> {
    await this.db.query(sql`delete from visitors.password_resets where visitor_id = ${visitorId}`);
    await this.db.query(sql`
      insert into visitors.password_resets (visitor_id, code_hash, expires_at)
      values (${visitorId}, ${codeHash}, ${expiresAt})
    `);
  }

  async findPendingForUpdate(visitorId: string): Promise<PasswordReset | null> {
    const row = await this.db.maybeOne<PasswordResetRow>(sql`
      select id, code_hash, expires_at, attempts
      from visitors.password_resets
      where visitor_id = ${visitorId} and used_at is null
      order by created_at desc
      limit 1
      for update
    `);
    return row
      ? { id: row.id, codeHash: row.code_hash, expiresAt: row.expires_at, attempts: row.attempts }
      : null;
  }

  async incrementAttempts(id: string): Promise<void> {
    await this.db.query(
      sql`update visitors.password_resets set attempts = attempts + 1 where id = ${id}`,
    );
  }

  async markUsed(id: string, at: Date): Promise<void> {
    await this.db.query(sql`update visitors.password_resets set used_at = ${at} where id = ${id}`);
  }

  async deleteStale(before: Date, limit: number): Promise<number> {
    const { rowCount } = await this.db.query(sql`
      delete from visitors.password_resets
      where id in (
        select id from visitors.password_resets
        where expires_at < ${before}
        order by expires_at
        limit ${limit}
      )
    `);
    return rowCount;
  }
}

import { ConflictError } from "../../../shared/domain/errors";
import type { Database } from "../../../shared/infra/database/database";
import {
  type ConstraintErrors,
  translateConstraintErrors,
} from "../../../shared/infra/database/errors";
import { sql } from "../../../shared/infra/database/sql";
import type {
  NewSession,
  RoleRepository,
  SessionRepository,
  StaffProfile,
  StaffProfileReader,
  StoreExistence,
  UserRepository,
} from "../domain/repositories";
import { type NewRole, Role } from "../domain/role";
import { Session, type SessionAudience } from "../domain/session";
import { type NewUser, User, type UserStatus } from "../domain/user";

/* Cargos ----------------------------------------------------------------- */

interface RoleRow {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  is_system: boolean;
}

const roleToDomain = (r: RoleRow) =>
  Role.restore({
    id: r.id,
    name: r.name,
    description: r.description,
    permissions: r.permissions,
    isSystem: r.is_system,
  });

const ROLE_ERRORS: ConstraintErrors = {
  roles_name_key: () => new ConflictError("Já existe um cargo com esse nome"),
};

export class PgRoleRepository implements RoleRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<Role | null> {
    const row = await this.db.maybeOne<RoleRow>(sql`
      select id, name, description, permissions, is_system from identity.roles where id = ${id}
    `);
    return row ? roleToDomain(row) : null;
  }

  async create(data: NewRole): Promise<Role> {
    const row = await translateConstraintErrors(
      () =>
        this.db.one<RoleRow>(sql`
          insert into identity.roles (name, description, permissions)
          values (${data.name}, ${data.description}, ${data.permissions})
          returning id, name, description, permissions, is_system
        `),
      ROLE_ERRORS,
    );
    return roleToDomain(row);
  }

  async save(role: Role): Promise<void> {
    const s = role.toState();
    await translateConstraintErrors(
      () =>
        this.db.query(sql`
          update identity.roles
          set name = ${s.name}, description = ${s.description}, permissions = ${s.permissions}
          where id = ${s.id}
        `),
      ROLE_ERRORS,
    );
  }

  async delete(id: string): Promise<void> {
    await this.db.query(sql`delete from identity.roles where id = ${id}`);
  }

  async countUsers(roleId: string): Promise<number> {
    const { n } = await this.db.one<{ n: number }>(
      sql`select count(*) as n from identity.users where role_id = ${roleId}`,
    );
    return n;
  }
}

/* Usuários --------------------------------------------------------------- */

interface UserRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role_id: string;
  store_id: string | null;
  status: UserStatus;
  must_change_password: boolean;
  last_login_at: Date | null;
}

const USER_COLUMNS = sql.raw(
  "id, name, email, password_hash, role_id, store_id, status, must_change_password, last_login_at",
);

const userToDomain = (r: UserRow) =>
  User.restore({
    id: r.id,
    name: r.name,
    email: r.email,
    passwordHash: r.password_hash,
    roleId: r.role_id,
    storeId: r.store_id,
    status: r.status,
    mustChangePassword: r.must_change_password,
    lastLoginAt: r.last_login_at,
  });

const USER_ERRORS: ConstraintErrors = {
  users_email_key: () => new ConflictError("Já existe um usuário com esse e-mail"),
};

export class PgUserRepository implements UserRepository, StaffProfileReader {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<User | null> {
    const row = await this.db.maybeOne<UserRow>(
      sql`select ${USER_COLUMNS} from identity.users where id = ${id}`,
    );
    return row ? userToDomain(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.db.maybeOne<UserRow>(
      sql`select ${USER_COLUMNS} from identity.users where lower(email) = lower(${email})`,
    );
    return row ? userToDomain(row) : null;
  }

  async create(data: NewUser): Promise<User> {
    const row = await translateConstraintErrors(
      () =>
        this.db.one<UserRow>(sql`
          insert into identity.users
            (name, email, password_hash, role_id, store_id, status, must_change_password)
          values
            (${data.name}, ${data.email}, ${data.passwordHash}, ${data.roleId}, ${data.storeId},
             ${data.status}, ${data.mustChangePassword})
          returning ${USER_COLUMNS}
        `),
      USER_ERRORS,
    );
    return userToDomain(row);
  }

  async save(user: User): Promise<void> {
    const s = user.toState();
    await translateConstraintErrors(
      () =>
        this.db.query(sql`
          update identity.users
          set name = ${s.name}, email = ${s.email}, password_hash = ${s.passwordHash},
              role_id = ${s.roleId}, store_id = ${s.storeId}, status = ${s.status},
              must_change_password = ${s.mustChangePassword}
          where id = ${s.id}
        `),
      USER_ERRORS,
    );
  }

  async recordLogin(id: string, at: Date): Promise<void> {
    await this.db.query(sql`update identity.users set last_login_at = ${at} where id = ${id}`);
  }

  async countOtherActiveAdmins(excludeUserId: string): Promise<number> {
    const { n } = await this.db.one<{ n: number }>(sql`
      select count(*) as n
      from identity.users u
      join identity.roles r on r.id = u.role_id
      where r.is_system and u.status = 'active' and u.id <> ${excludeUserId}
    `);
    return n;
  }

  async findProfile(userId: string): Promise<StaffProfile | null> {
    const row = await this.db.maybeOne<{
      id: string;
      name: string;
      status: UserStatus;
      role_id: string;
      permissions: string[];
      store_id: string | null;
    }>(sql`
      select u.id, u.name, u.status, u.role_id, r.permissions, u.store_id
      from identity.users u
      join identity.roles r on r.id = u.role_id
      where u.id = ${userId}
    `);
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      status: row.status,
      roleId: row.role_id,
      permissions: row.permissions,
      storeId: row.store_id,
    };
  }
}

/* Sessões ---------------------------------------------------------------- */

interface SessionRow {
  id: string;
  audience: SessionAudience;
  subject_id: string;
  family_id: string;
  expires_at: Date;
  revoked_at: Date | null;
  replaced_by_id: string | null;
  last_used_at: Date | null;
}

const SESSION_COLUMNS = sql.raw(
  "id, audience, subject_id, family_id, expires_at, revoked_at, replaced_by_id, last_used_at",
);

const sessionToDomain = (r: SessionRow) =>
  Session.restore({
    id: r.id,
    audience: r.audience,
    subjectId: r.subject_id,
    familyId: r.family_id,
    expiresAt: r.expires_at,
    revokedAt: r.revoked_at,
    replacedById: r.replaced_by_id,
    lastUsedAt: r.last_used_at,
  });

export class PgSessionRepository implements SessionRepository {
  constructor(private readonly db: Database) {}

  async create(data: NewSession): Promise<Session> {
    // Família nova usa o próprio id da sessão como id da família.
    const row = await this.db.one<SessionRow>(sql`
      with new_id as (select public.uuid_generate_v7() as id)
      insert into identity.sessions
        (id, audience, subject_id, family_id, token_hash, expires_at, user_agent, ip)
      select id, ${data.audience}, ${data.subjectId}, coalesce(${data.familyId}::uuid, id),
             ${data.tokenHash}, ${data.expiresAt}, ${data.userAgent?.slice(0, 400) ?? null},
             ${data.ip}::inet
      from new_id
      returning ${SESSION_COLUMNS}
    `);
    return sessionToDomain(row);
  }

  async findByTokenHashForUpdate(tokenHash: string): Promise<Session | null> {
    const row = await this.db.maybeOne<SessionRow>(sql`
      select ${SESSION_COLUMNS} from identity.sessions where token_hash = ${tokenHash} for update
    `);
    return row ? sessionToDomain(row) : null;
  }

  async findByIdForUpdate(id: string): Promise<Session | null> {
    const row = await this.db.maybeOne<SessionRow>(sql`
      select ${SESSION_COLUMNS} from identity.sessions where id = ${id} for update
    `);
    return row ? sessionToDomain(row) : null;
  }

  async markRotated(id: string, replacedById: string, at: Date): Promise<void> {
    await this.db.query(sql`
      update identity.sessions
      set revoked_at = ${at}, replaced_by_id = ${replacedById}, last_used_at = ${at}
      where id = ${id}
    `);
  }

  async revoke(id: string, at: Date): Promise<void> {
    await this.db.query(sql`
      update identity.sessions set revoked_at = coalesce(revoked_at, ${at}) where id = ${id}
    `);
  }

  async revokeFamily(familyId: string, at: Date, exceptId?: string): Promise<number> {
    const { rowCount } = await this.db.query(sql`
      update identity.sessions set revoked_at = ${at}
      where family_id = ${familyId} and revoked_at is null
        ${exceptId ? sql`and id <> ${exceptId}` : sql.empty}
    `);
    return rowCount;
  }

  async revokeAllForSubject(
    subjectId: string,
    audience: SessionAudience,
    at: Date,
    exceptFamilyId?: string,
  ): Promise<number> {
    const { rowCount } = await this.db.query(sql`
      update identity.sessions set revoked_at = ${at}
      where subject_id = ${subjectId} and audience = ${audience} and revoked_at is null
        ${exceptFamilyId ? sql`and family_id <> ${exceptFamilyId}` : sql.empty}
    `);
    return rowCount;
  }

  async deleteRotated(olderThan: Date, limit: number): Promise<number> {
    const { rowCount } = await this.db.query(sql`
      delete from identity.sessions
      where id in (
        select id from identity.sessions
        where replaced_by_id is not null and created_at < ${olderThan}
        order by created_at
        limit ${limit}
      )
    `);
    return rowCount;
  }

  async deleteExpired(olderThan: Date, limit: number): Promise<number> {
    const { rowCount } = await this.db.query(sql`
      delete from identity.sessions
      where id in (
        select id from identity.sessions where expires_at < ${olderThan} order by expires_at limit ${limit}
      )
    `);
    return rowCount;
  }
}

/* Lojas ------------------------------------------------------------------ */

export class PgStoreExistence implements StoreExistence {
  constructor(private readonly db: Database) {}

  exists(storeId: string): Promise<boolean> {
    return this.db.exists(sql`select 1 from directory.stores where id = ${storeId}`);
  }
}

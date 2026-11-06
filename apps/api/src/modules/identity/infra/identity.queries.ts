import {
  type AuthUser,
  type ListUsersQuery,
  type Permission,
  type Role,
  type User,
  withImpliedPermissions,
} from "@arp/contracts";
import { offsetOf, type Page, toPage } from "../../../shared/application/pagination";
import type { Database } from "../../../shared/infra/database/database";
import { sql } from "../../../shared/infra/database/sql";
import { iso, isoOrNull } from "../../../shared/infra/presenters";

interface UserRow {
  id: string;
  name: string;
  email: string;
  status: "active" | "disabled";
  role_id: string;
  role_name: string;
  store_id: string | null;
  store_name: string | null;
  must_change_password: boolean;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
  in_use?: boolean;
}

const USER_COLUMNS = sql`
  u.id, u.name, u.email, u.status, u.role_id, r.name as role_name,
  u.store_id, s.name as store_name, u.must_change_password, u.last_login_at,
  u.created_at, u.updated_at
`;

// "Em uso" = as FKs que impedem o delete (as outras viram null ao excluir).
// Só na lista e no detalhe (não no login/me).
const USER_IN_USE = sql`
  (exists (select 1 from promotions.coupons x where x.created_by = u.id)
   or exists (select 1 from promotions.coupon_claims x where x.redeemed_by = u.id)
   or exists (select 1 from marketing.push_notifications x where x.created_by = u.id)
   or exists (select 1 from platform.settings x where x.updated_by = u.id)) as in_use
`;

const USER_FROM = sql`
  from identity.users u
  join identity.roles r on r.id = u.role_id
  left join directory.stores s on s.id = u.store_id
`;

function toUser(r: UserRow): User {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    status: r.status,
    role: { id: r.role_id, name: r.role_name },
    store: r.store_id ? { id: r.store_id, name: r.store_name ?? "" } : null,
    mustChangePassword: r.must_change_password,
    lastLoginAt: isoOrNull(r.last_login_at),
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
    inUse: r.in_use,
  };
}

/** Leituras do módulo identity, já no formato do contrato. */
export class IdentityQueries {
  constructor(
    private readonly db: Database,
    private readonly knownPermissions: ReadonlySet<string>,
  ) {}

  private permissionsOf(list: string[]): Permission[] {
    return withImpliedPermissions(list).filter((p): p is Permission =>
      this.knownPermissions.has(p),
    );
  }

  async authUser(userId: string): Promise<AuthUser | null> {
    const row = await this.db.maybeOne<UserRow & { permissions: string[] }>(sql`
      select ${USER_COLUMNS}, r.permissions ${USER_FROM} where u.id = ${userId}
    `);
    if (!row) return null;
    const user = toUser(row);
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      permissions: this.permissionsOf(row.permissions),
      store: user.store,
      mustChangePassword: user.mustChangePassword,
    };
  }

  async listRoles(id?: string): Promise<Role[]> {
    const rows = await this.db.many<{
      id: string;
      name: string;
      description: string | null;
      permissions: string[];
      is_system: boolean;
      users_count: number;
      created_at: Date;
      updated_at: Date;
    }>(sql`
      select r.id, r.name, r.description, r.permissions, r.is_system, r.created_at, r.updated_at,
             (select count(*) from identity.users u where u.role_id = r.id) as users_count
      from identity.roles r
      ${sql.where([id && sql`r.id = ${id}`])}
      order by r.is_system desc, r.name
    `);
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      permissions: this.permissionsOf(r.permissions),
      isSystem: r.is_system,
      usersCount: r.users_count,
      createdAt: iso(r.created_at),
      updatedAt: iso(r.updated_at),
    }));
  }

  async getRole(id: string): Promise<Role | null> {
    return (await this.listRoles(id))[0] ?? null;
  }

  async listUsers(query: ListUsersQuery): Promise<Page<User>> {
    const rows = await this.db.many<UserRow & { total: number }>(sql`
      select ${USER_COLUMNS}, ${USER_IN_USE}, count(*) over() as total
      ${USER_FROM}
      ${sql.where([
        query.roleId && sql`u.role_id = ${query.roleId}`,
        query.storeId && sql`u.store_id = ${query.storeId}`,
        query.status && sql`u.status = ${query.status}`,
        query.q &&
          sql`(public.f_unaccent(lower(u.name)) like ${sql.containsPattern(query.q)}
               or lower(u.email) like ${sql.containsPattern(query.q)})`,
      ])}
      order by u.name, u.id
      limit ${query.pageSize} offset ${offsetOf(query)}
    `);
    return toPage(rows, query, toUser);
  }

  async getUser(id: string): Promise<User | null> {
    const row = await this.db.maybeOne<UserRow>(
      sql`select ${USER_COLUMNS}, ${USER_IN_USE} ${USER_FROM} where u.id = ${id}`,
    );
    return row ? toUser(row) : null;
  }
}

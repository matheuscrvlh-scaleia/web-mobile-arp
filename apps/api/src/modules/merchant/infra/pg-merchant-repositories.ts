import type { App } from "@arp/contracts";
import type { Database } from "../../../shared/infra/database/database";
import { type SqlFragment, sql } from "../../../shared/infra/database/sql";
import type { MerchantStoreReader } from "../application/merchant-scope";
import type { MerchantAccount, MerchantAccountStatus } from "../domain/merchant";
import type { MerchantAccountRepository } from "../domain/repositories";

/* Contas (usuários do painel) -------------------------------------------- */

interface AccountRow {
  id: string;
  name: string;
  password_hash: string;
  status: MerchantAccountStatus;
  role_id: string;
  permissions: string[];
  store_id: string | null;
}

const ACCOUNT_SELECT = sql`
  select u.id, u.name, u.password_hash, u.status, u.role_id, r.permissions, u.store_id
  from identity.users u
  join identity.roles r on r.id = u.role_id
`;

const accountToDomain = (r: AccountRow): MerchantAccount => ({
  id: r.id,
  name: r.name,
  passwordHash: r.password_hash,
  status: r.status,
  roleId: r.role_id,
  permissions: r.permissions,
  storeId: r.store_id,
});

export class PgMerchantAccountRepository implements MerchantAccountRepository {
  constructor(private readonly db: Database) {}

  private async findOne(where: SqlFragment): Promise<MerchantAccount | null> {
    const row = await this.db.maybeOne<AccountRow>(sql`${ACCOUNT_SELECT} where ${where}`);
    return row ? accountToDomain(row) : null;
  }

  findByEmail(email: string): Promise<MerchantAccount | null> {
    return this.findOne(sql`lower(u.email) = lower(${email})`);
  }

  findById(id: string): Promise<MerchantAccount | null> {
    return this.findOne(sql`u.id = ${id}`);
  }

  async recordLogin(id: string, at: Date): Promise<void> {
    await this.db.query(sql`update identity.users set last_login_at = ${at} where id = ${id}`);
  }
}

/* Lojas ------------------------------------------------------------------ */

interface StoreRow {
  id: string;
  slug: string;
  name: string;
  icon: string;
  brand_color: string;
}

const STORE_SELECT = sql`select s.id, s.slug, s.name, s.icon, s.brand_color from directory.stores s`;

const toMerchantStore = (r: StoreRow): App.MerchantStore => ({
  id: r.id,
  slug: r.slug,
  name: r.name,
  icon: r.icon,
  brandColor: r.brand_color,
});

export class PgMerchantStoreReader implements MerchantStoreReader {
  constructor(private readonly db: Database) {}

  async storesFor(storeId: string | null): Promise<App.MerchantStore[]> {
    // Sem loja: as ativas, pelo índice (status, name).
    const rows = await this.db.many<StoreRow>(
      storeId
        ? sql`${STORE_SELECT} where s.id = ${storeId}`
        : sql`${STORE_SELECT} where s.status = 'active' order by s.name, s.id`,
    );
    return rows.map(toMerchantStore);
  }

  async find(storeId: string): Promise<App.MerchantStore | null> {
    const row = await this.db.maybeOne<StoreRow>(sql`${STORE_SELECT} where s.id = ${storeId}`);
    return row ? toMerchantStore(row) : null;
  }

  exists(storeId: string): Promise<boolean> {
    return this.db.exists(sql`select 1 from directory.stores where id = ${storeId}`);
  }

  async soleActiveStoreId(): Promise<string | null> {
    const rows = await this.db.many<{ id: string }>(
      sql`select id from directory.stores where status = 'active' limit 2`,
    );
    return rows.length === 1 ? (rows[0]?.id ?? null) : null;
  }
}

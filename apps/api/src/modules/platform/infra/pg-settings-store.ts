import type { AppSettings } from "@arp/contracts";
import type { Database } from "../../../shared/infra/database/database";
import { sql } from "../../../shared/infra/database/sql";
import type { SettingsStore } from "../application/app-settings";

export class PgSettingsStore implements SettingsStore {
  constructor(private readonly db: Database) {}

  async readAll(): Promise<Record<string, unknown>> {
    const rows = await this.db.many<{ key: string; value: unknown }>(
      sql`select key, value from platform.settings`,
    );
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }

  async upsert(key: keyof AppSettings, value: unknown, updatedBy: string | null): Promise<void> {
    await this.db.query(sql`
      insert into platform.settings (key, value, updated_by)
      values (${key}, ${JSON.stringify(value)}::jsonb, ${updatedBy})
      on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by
    `);
  }
}

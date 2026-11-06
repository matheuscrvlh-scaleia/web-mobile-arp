import type { Database } from "../../../shared/infra/database/database";
import { sql } from "../../../shared/infra/database/sql";

/** Ordem dos itens do Sustentarp (arrastar no painel). */
export class PgRecyclingOrder {
  constructor(private readonly db: Database) {}

  /** Ids de todos os itens, com trava (dois editores ao mesmo tempo). */
  async lockAllIds(): Promise<string[]> {
    const rows = await this.db.many<{ id: string }>(
      sql`select id from content.recycling_items order by sort_order, name for update`,
    );
    return rows.map((r) => r.id);
  }

  /** sort_order = posição (1..n) na ordem dada. */
  async apply(ids: readonly string[]): Promise<void> {
    await this.db.query(sql`
      update content.recycling_items i
      set sort_order = o.position
      from unnest(${[...ids]}::uuid[]) with ordinality as o(id, position)
      where i.id = o.id and i.sort_order is distinct from o.position
    `);
  }
}

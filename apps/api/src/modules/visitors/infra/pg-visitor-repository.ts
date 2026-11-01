import type { Database } from "../../../shared/infra/database/database";
import { sql } from "../../../shared/infra/database/sql";
import type { VisitorRepository } from "../domain/repositories";
import { Visitor, type VisitorStatus } from "../domain/visitor";

export class PgVisitorRepository implements VisitorRepository {
  constructor(private readonly db: Database) {}

  async findByIdForUpdate(id: string): Promise<Visitor | null> {
    const row = await this.db.maybeOne<{
      id: string;
      name: string;
      status: VisitorStatus;
      blocked_reason: string | null;
    }>(sql`
      select id, name, status, blocked_reason from visitors.visitors where id = ${id} for update
    `);
    if (!row) return null;
    return Visitor.restore({
      id: row.id,
      name: row.name,
      status: row.status,
      blockedReason: row.blocked_reason,
    });
  }

  async save(visitor: Visitor): Promise<void> {
    const s = visitor.toState();
    await this.db.query(sql`
      update visitors.visitors set status = ${s.status}, blocked_reason = ${s.blockedReason}
      where id = ${s.id}
    `);
  }
}

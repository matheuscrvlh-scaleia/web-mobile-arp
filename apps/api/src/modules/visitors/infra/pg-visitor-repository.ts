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
      anonymized_at: Date | null;
    }>(sql`
      select id, name, status, blocked_reason, anonymized_at
      from visitors.visitors where id = ${id} for update
    `);
    if (!row) return null;
    return Visitor.restore({
      id: row.id,
      name: row.name,
      status: row.status,
      blockedReason: row.blocked_reason,
      anonymizedAt: row.anonymized_at,
    });
  }

  async save(visitor: Visitor): Promise<void> {
    const s = visitor.toState();
    await this.db.query(sql`
      update visitors.visitors set status = ${s.status}, blocked_reason = ${s.blockedReason}
      where id = ${s.id}
    `);
  }

  async erasePersonalData(visitor: Visitor): Promise<void> {
    const s = visitor.toState();
    // E-mail único e válido que não identifica ninguém (o id já é aleatório).
    const email = `anonimizado-${s.id}@anonimizado.invalid`;
    await this.db.query(sql`
      update visitors.visitors
      set name = ${s.name}, email = ${email}, phone = null, avatar_url = null,
          auth_provider = 'password', provider_subject = null,
          -- Hash que nenhuma senha confere: a conta não entra mais.
          password_hash = '!anonimizado',
          marketing_opt_in = false, ranking_nickname = null, ranking_accepted_at = null,
          status = ${s.status}, blocked_reason = ${s.blockedReason},
          anonymized_at = ${s.anonymizedAt}
      where id = ${s.id}
    `);
    await this.db.query(sql`delete from visitors.push_tokens where visitor_id = ${s.id}`);
    await this.db.query(sql`delete from visitors.password_resets where visitor_id = ${s.id}`);
    // Histórico: o nome (autor), IP e navegador das ações feitas no app e os
    // campos das linhas sobre a conta (cadastro, perfil). A trigger só deixa
    // mexer nisso com a marca ligada, e só nesta transação.
    await this.db.query(sql`select set_config('arp.lgpd_erase', 'on', true)`);
    await this.db.query(sql`
      update audit.audit_logs set actor_name = ${s.name}, ip = null, user_agent = null
      where actor_type = 'visitor' and actor_id = ${s.id}
    `);
    await this.db.query(sql`
      update audit.audit_logs set changes = null
      where entity_type = 'visitor' and entity_id = ${s.id}
    `);
    await this.db.query(sql`select set_config('arp.lgpd_erase', 'off', true)`);
  }
}

import { ConflictError } from "../../../shared/domain/errors";
import { visitorPointsSql } from "../../../shared/infra/database/club-points";
import type { Database } from "../../../shared/infra/database/database";
import { translateConstraintErrors } from "../../../shared/infra/database/errors";
import { sql } from "../../../shared/infra/database/sql";
// atalho: reaproveita o cadastro genérico do guia (como o módulo de conteúdo)
import { PgCatalogRepository } from "../../directory/infra/pg-directory-repositories";
import type { PrizeProps } from "../domain/club";

export const prizeRepository = (db: Database) =>
  new PgCatalogRepository<PrizeProps>(db, {
    table: "gamification.prizes",
    columns: {
      name: "name",
      description: "description",
      kind: "kind",
      points: "points",
      stock: "stock",
      imageUrl: "image_url",
      pickupRules: "pickup_rules",
      active: "active",
      sortOrder: "sort_order",
    },
    errors: {},
    inUseMessage: "Este prêmio já foi trocado. Desative em vez de apagar.",
  });

export class RedemptionCodeCollisionError extends Error {}

export interface RedemptionState {
  id: string;
  status: "pending" | "delivered" | "cancelled";
  visitorId: string;
  prizeId: string;
  expiresAt: Date | null;
}

/** Escritas do Clube: trocas (app e balcão), entrega, cancelamento e apelido do ranking. */
export class PgClubStore {
  constructor(private readonly db: Database) {}

  /**
   * Trava o visitante até o fim da transação: duas trocas ao mesmo tempo não
   * gastam o mesmo Trevo. Devolve a conta (null = não existe).
   */
  lockVisitor(visitorId: string): Promise<{ name: string; status: string } | null> {
    return this.db.maybeOne(
      sql`select name, status from visitors.visitors where id = ${visitorId} for update`,
    );
  }

  async points(visitorId: string, now: Date): Promise<number> {
    const { total } = await this.db.one<{ total: number }>(
      sql`select ${visitorPointsSql(sql`${visitorId}::uuid`, now)} as total`,
    );
    return total;
  }

  activePrize(
    id: string,
  ): Promise<{ id: string; name: string; points: number; image_url: string | null } | null> {
    return this.db.maybeOne(sql`
      select id, name, points, image_url from gamification.prizes where id = ${id} and active
    `);
  }

  /** Baixa uma unidade; false = acabou. */
  async takeStock(prizeId: string): Promise<boolean> {
    // `exists` embrulha em select, e update dentro de select não é SQL válido.
    const { rowCount } = await this.db.query(sql`
      update gamification.prizes set stock = stock - 1
      where id = ${prizeId} and stock > 0
    `);
    return rowCount > 0;
  }

  /**
   * Grava a troca. Balcão: já entregue por quem trocou (`by`). App: pendente
   * até `expiresAt`, esperando o Mercado Local validar o código.
   */
  async insertRedemption(d: {
    prizeId: string;
    visitorId: string;
    points: number;
    code: string;
    at: Date;
    delivery: { by: string } | { expiresAt: Date };
  }): Promise<string> {
    const delivered = "by" in d.delivery;
    const by = "by" in d.delivery ? d.delivery.by : null;
    const expiresAt = "expiresAt" in d.delivery ? d.delivery.expiresAt : null;
    const { id } = await translateConstraintErrors(
      () =>
        this.db.one<{ id: string }>(sql`
          insert into gamification.prize_redemptions
            (prize_id, visitor_id, points, code, status, created_at, expires_at, delivered_at,
             delivered_by)
          values (${d.prizeId}, ${d.visitorId}, ${d.points}, ${d.code},
                  ${delivered ? "delivered" : "pending"}, ${d.at}, ${expiresAt},
                  ${delivered ? d.at : null}, ${by})
          returning id
        `),
      { prize_redemptions_code_key: () => new RedemptionCodeCollisionError() },
    );
    return id;
  }

  /** Lê e trava a troca até o fim da transação (null = não existe). */
  async lockRedemption(id: string): Promise<RedemptionState | null> {
    const row = await this.db.maybeOne<{
      id: string;
      status: RedemptionState["status"];
      visitor_id: string;
      prize_id: string;
      expires_at: Date | null;
    }>(sql`
      select id, status, visitor_id, prize_id, expires_at
      from gamification.prize_redemptions where id = ${id} for update
    `);
    return row
      ? {
          id: row.id,
          status: row.status,
          visitorId: row.visitor_id,
          prizeId: row.prize_id,
          expiresAt: row.expires_at,
        }
      : null;
  }

  async markDelivered(id: string, by: string, now: Date): Promise<void> {
    await this.db.query(sql`
      update gamification.prize_redemptions
      set status = 'delivered', delivered_at = ${now}, delivered_by = ${by}
      where id = ${id}
    `);
  }

  /**
   * Cancela e devolve a unidade ao estoque (os Trevos voltam sozinhos: a soma
   * ignora troca cancelada). `by` null = o próprio visitante ou o prazo.
   */
  async markCancelled(r: RedemptionState, by: string | null, now: Date): Promise<void> {
    await this.db.query(sql`
      update gamification.prize_redemptions
      set status = 'cancelled', cancelled_at = ${now}, cancelled_by = ${by}
      where id = ${r.id}
    `);
    await this.db.query(sql`
      update gamification.prizes set stock = stock + 1 where id = ${r.prizeId}
    `);
  }

  /**
   * Trocas do app que passaram do prazo sem retirada: cancela e devolve o
   * estoque numa instrução só (duas réplicas não devolvem em dobro).
   */
  async expirePending(now: Date): Promise<number> {
    const rows = await this.db.many<{ n: number }>(sql`
      with gone as (
        update gamification.prize_redemptions
        set status = 'cancelled', cancelled_at = ${now}
        where status = 'pending' and expires_at <= ${now}
        returning prize_id
      ),
      back as (
        update gamification.prizes p set stock = p.stock + x.n
        from (select prize_id, count(*)::int as n from gone group by prize_id) x
        where x.prize_id = p.id
        returning x.n
      )
      select n from back
    `);
    return rows.reduce((sum, r) => sum + r.n, 0);
  }

  async setNickname(visitorId: string, nickname: string | null, now: Date): Promise<void> {
    await translateConstraintErrors(
      () =>
        this.db.query(sql`
          update visitors.visitors
          set ranking_nickname = ${nickname},
              ranking_accepted_at = ${nickname === null ? null : now}
          where id = ${visitorId}
        `),
      {
        visitors_ranking_nickname_key: () =>
          new ConflictError("Esse apelido já está em uso. Escolha outro."),
      },
    );
  }
}

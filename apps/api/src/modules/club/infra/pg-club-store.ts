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
      active: "active",
      sortOrder: "sort_order",
    },
    errors: {},
    inUseMessage: "Este prêmio já foi trocado. Desative em vez de apagar.",
  });

export class RedemptionCodeCollisionError extends Error {}

/** Escritas do Clube: trocas no balcão, cancelamento e apelido do ranking. */
export class PgClubStore {
  constructor(private readonly db: Database) {}

  /**
   * Trava o visitante até o fim da transação: duas trocas ao mesmo tempo não
   * gastam o mesmo ponto. Devolve a conta (null = não existe).
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

  activePrize(id: string): Promise<{ id: string; name: string; points: number } | null> {
    return this.db.maybeOne(sql`
      select id, name, points from gamification.prizes where id = ${id} and active
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

  /** Grava a troca do balcão, já entregue por quem trocou. */
  async insertRedemption(d: {
    prizeId: string;
    visitorId: string;
    points: number;
    code: string;
    by: string;
    at: Date;
  }): Promise<string> {
    const { id } = await translateConstraintErrors(
      () =>
        this.db.one<{ id: string }>(sql`
          insert into gamification.prize_redemptions
            (prize_id, visitor_id, points, code, status, created_at, delivered_at, delivered_by)
          values (${d.prizeId}, ${d.visitorId}, ${d.points}, ${d.code}, 'delivered',
                  ${d.at}, ${d.at}, ${d.by})
          returning id
        `),
      { prize_redemptions_code_key: () => new RedemptionCodeCollisionError() },
    );
    return id;
  }

  /**
   * Cancela e devolve a unidade ao estoque (os pontos voltam sozinhos: a soma
   * ignora troca cancelada). null = não existe; "done" = já cancelada.
   */
  async cancel(id: string, by: string, now: Date): Promise<"ok" | "done" | null> {
    const row = await this.db.maybeOne<{ status: string; prize_id: string }>(sql`
      select status, prize_id from gamification.prize_redemptions where id = ${id} for update
    `);
    if (!row) return null;
    if (row.status === "cancelled") return "done";
    await this.db.query(sql`
      update gamification.prize_redemptions
      set status = 'cancelled', cancelled_at = ${now}, cancelled_by = ${by}
      where id = ${id}
    `);
    await this.db.query(sql`
      update gamification.prizes set stock = stock + 1 where id = ${row.prize_id}
    `);
    return "ok";
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

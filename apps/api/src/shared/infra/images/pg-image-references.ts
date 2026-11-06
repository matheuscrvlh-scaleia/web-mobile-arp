import type { ImageReferences } from "../../application/ports/images";
import type { Database } from "../database/database";
import { sql } from "../database/sql";

/**
 * Colunas que guardam URL de imagem do storage. Coluna nova de imagem entra
 * aqui: a limpeza ao trocar/apagar e o backfill das miniaturas leem esta lista.
 */
export const IMAGE_URL_COLUMNS = [
  { table: "directory.stores", column: "cover_image_url" },
  { table: "directory.stores", column: "logo_url" },
  { table: "directory.floors", column: "background_url" },
  { table: "promotions.coupons", column: "image_url" },
  { table: "agenda.events", column: "image_url" },
  { table: "marketing.highlights", column: "image_url" },
  { table: "visitors.visitors", column: "avatar_url" },
] as const;

export class PgImageReferences implements ImageReferences {
  constructor(private readonly db: Database) {}

  async isReferenced(url: string): Promise<boolean> {
    const checks = IMAGE_URL_COLUMNS.map(
      ({ table, column }) =>
        sql`exists (select 1 from ${sql.identifier(table)} where ${sql.identifier(column)} = ${url})`,
    );
    const { used } = await this.db.one<{ used: boolean }>(sql`select ${sql.or(checks)} as used`);
    return used;
  }
}

/** Todas as URLs de imagem gravadas no banco, sem repetição. */
export async function listImageUrls(db: Database): Promise<string[]> {
  const parts = IMAGE_URL_COLUMNS.map(
    ({ table, column }) =>
      sql`select ${sql.identifier(column)} as url from ${sql.identifier(table)} where ${sql.identifier(column)} is not null`,
  );
  const rows = await db.many<{ url: string }>(
    sql`select url from (${sql.join(parts, " union ")}) u order by url`,
  );
  return rows.map((r) => r.url);
}

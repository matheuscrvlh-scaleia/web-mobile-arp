import type { ContentPageKey, UpdateContentPageBody } from "@arp/contracts";
import { ConflictError } from "../../../shared/domain/errors";
import type { Database } from "../../../shared/infra/database/database";
import { sql } from "../../../shared/infra/database/sql";
// atalho: reaproveita o cadastro genérico do guia (mover para shared se um 3º módulo usar)
import { PgCatalogRepository } from "../../directory/infra/pg-directory-repositories";
import type { ArtPointProps, JobProps, RecyclingItemProps } from "../domain/content";

export const artPointRepository = (db: Database) =>
  new PgCatalogRepository<ArtPointProps>(db, {
    table: "content.art_points",
    columns: {
      number: "number",
      name: "name",
      artist: "artist",
      place: "place",
      kind: "kind",
      description: "description",
      imageUrl: "image_url",
      mapX: "map_x",
      mapY: "map_y",
      active: "active",
    },
    errors: {
      art_points_number_key: () => new ConflictError("Já existe um ponto com esse número"),
      art_points_location_pair: () =>
        new ConflictError("Informe as duas coordenadas do ponto (ou nenhuma)"),
    },
    inUseMessage: "Este ponto está em uso.",
  });

export const recyclingItemRepository = (db: Database) =>
  new PgCatalogRepository<RecyclingItemProps>(db, {
    table: "content.recycling_items",
    columns: {
      name: "name",
      icon: "icon",
      accepts: "accepts",
      rejects: "rejects",
      becomes: "becomes",
      givesSeal: "gives_seal",
      sortOrder: "sort_order",
      active: "active",
    },
    errors: {
      recycling_items_name_key: () => new ConflictError("Já existe um item com esse nome"),
    },
    inUseMessage: "Este item está em uso.",
  });

export const jobRepository = (db: Database) =>
  new PgCatalogRepository<JobProps>(db, {
    table: "content.jobs",
    columns: {
      storeId: "store_id",
      title: "title",
      text: "text",
      imageUrl: "image_url",
      whatsapp: "whatsapp",
      expiresAt: "expires_at",
      createdBy: "created_by",
    },
    errors: {},
    inUseMessage: "Esta vaga está em uso.",
  });

/** Textos: uma linha por chave, criada na primeira edição. */
export class PgContentPages {
  constructor(private readonly db: Database) {}

  async upsert(
    key: ContentPageKey,
    defaultTitle: string,
    changes: UpdateContentPageBody,
    updatedBy: string,
  ): Promise<void> {
    await this.db.query(sql`
      insert into content.pages (key, title, body, file_url, updated_by)
      values (${key}, ${changes.title ?? defaultTitle}, ${changes.body ?? ""},
              ${changes.fileUrl ?? null}, ${updatedBy})
      on conflict (key) do update set
        title = coalesce(${changes.title ?? null}, content.pages.title),
        body = coalesce(${changes.body ?? null}, content.pages.body),
        file_url = case when ${changes.fileUrl !== undefined} then ${changes.fileUrl ?? null}
                        else content.pages.file_url end,
        updated_by = ${updatedBy},
        updated_at = now()
    `);
  }
}

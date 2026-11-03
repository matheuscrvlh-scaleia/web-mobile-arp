import {
  type ArtPoint,
  CONTENT_PAGE_LABEL,
  type ContentPage,
  type ContentPageKey,
  contentPageKeySchema,
  type Job,
  type ListJobsQuery,
  type RecyclingItem,
} from "@arp/contracts";
import type { Database } from "../../../shared/infra/database/database";
import { sql } from "../../../shared/infra/database/sql";
import { iso } from "../../../shared/infra/presenters";

/** Leituras do conteúdo (painel e app), já no formato do contrato. */
export class ContentQueries {
  constructor(private readonly db: Database) {}

  /** As 4 páginas, sempre: sem linha no banco = título padrão e texto vazio. */
  async pages(): Promise<ContentPage[]> {
    const rows = await this.db.many<{
      key: ContentPageKey;
      title: string;
      body: string;
      file_url: string | null;
      updated_at: Date;
    }>(sql`select key, title, body, file_url, updated_at from content.pages`);
    const byKey = new Map(rows.map((r) => [r.key, r]));
    return contentPageKeySchema.options.map((key) => {
      const r = byKey.get(key);
      return {
        key,
        title: r?.title ?? CONTENT_PAGE_LABEL[key],
        body: r?.body ?? "",
        fileUrl: r?.file_url ?? null,
        updatedAt: r ? iso(r.updated_at) : null,
      };
    });
  }

  async page(key: ContentPageKey): Promise<ContentPage> {
    return (await this.pages()).find((p) => p.key === key) as ContentPage;
  }

  /** `onlyActive`: o app só vê os ativos. */
  async artPoints(opts: { id?: string; onlyActive?: boolean } = {}): Promise<ArtPoint[]> {
    return this.db.many<ArtPoint>(sql`
      select id, number, name, artist, place, kind, description, image_url as "imageUrl",
             map_x as "mapX", map_y as "mapY", active
      from content.art_points
      ${sql.where([opts.id && sql`id = ${opts.id}`, opts.onlyActive && sql`active`])}
      order by number
    `);
  }

  async recyclingItems(opts: { id?: string; onlyActive?: boolean } = {}): Promise<RecyclingItem[]> {
    return this.db.many<RecyclingItem>(sql`
      select id, name, icon, accepts, rejects, becomes, gives_seal as "givesSeal",
             sort_order as "sortOrder", active
      from content.recycling_items
      ${sql.where([opts.id && sql`id = ${opts.id}`, opts.onlyActive && sql`active`])}
      order by sort_order, name
    `);
  }

  /** Vagas, mais novas primeiro. `storeId` presente = escopo do lojista. */
  async jobs(query: ListJobsQuery & { id?: string }, now: Date): Promise<Job[]> {
    const rows = await this.db.many<{
      id: string;
      title: string;
      text: string;
      image_url: string | null;
      whatsapp: string;
      published_at: Date;
      expires_at: Date;
      store_id: string;
      store_slug: string;
      store_name: string;
      store_icon: string;
      store_brand_color: string;
    }>(sql`
      select j.id, j.title, j.text, j.image_url, j.whatsapp, j.published_at, j.expires_at,
             s.id as store_id, s.slug as store_slug, s.name as store_name, s.icon as store_icon,
             s.brand_color as store_brand_color
      from content.jobs j
      join directory.stores s on s.id = j.store_id
      ${sql.where([
        query.id && sql`j.id = ${query.id}`,
        query.storeId && sql`j.store_id = ${query.storeId}`,
        query.status === "live" && sql`j.expires_at > ${now} and s.status = 'active'`,
        query.status === "expired" && sql`j.expires_at <= ${now}`,
      ])}
      order by j.published_at desc, j.id desc
      limit 200
    `);
    return rows.map((r) => ({
      id: r.id,
      store: {
        id: r.store_id,
        slug: r.store_slug,
        name: r.store_name,
        icon: r.store_icon,
        brandColor: r.store_brand_color,
      },
      title: r.title,
      text: r.text,
      imageUrl: r.image_url,
      whatsapp: r.whatsapp,
      publishedAt: iso(r.published_at),
      expiresAt: iso(r.expires_at),
      isLive: r.expires_at > now,
    }));
  }
}

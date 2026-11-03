import { ConflictError, ValidationError } from "../../../shared/domain/errors";
import type { Database } from "../../../shared/infra/database/database";
import {
  type ConstraintErrors,
  translateConstraintErrors,
  translateInUseError,
} from "../../../shared/infra/database/errors";
import { escapeLike, type SqlFragment, sql } from "../../../shared/infra/database/sql";
import { FLOOR_NOT_FOUND } from "../application/catalog-deps";
import {
  type BlockProps,
  CatalogItem,
  type FloorProps,
  type MapPointProps,
  type StoreCategoryProps,
} from "../domain/catalog";
import type { DailyHours } from "../domain/opening-hours";
import type {
  CatalogRepository,
  DirectoryReferences,
  StoreRefs,
  StoreRepository,
} from "../domain/repositories";
import { type NewStore, Store, type StoreProps } from "../domain/store";
import { STORE_HOURS_JSON } from "./fragments";

/* Cadastros simples ------------------------------------------------------ */

interface TableSpec<P extends { id: string }> {
  table: string;
  /** Propriedade → coluna. */
  columns: { [K in Exclude<keyof P, "id">]: string };
  jsonColumns?: Exclude<keyof P, "id">[];
  /** Unique (duplicado) e FK ao gravar (referência inexistente) → erro de domínio. */
  errors: ConstraintErrors;
  /** Apagar com algo ainda apontando para o registro. */
  inUseMessage: string;
}

/** Repositório de cadastro dirigido por uma tabela (colunas explícitas, sem select *). */
export class PgCatalogRepository<P extends { id: string }>
  implements CatalogRepository<P, CatalogItem<P>>
{
  private readonly select: SqlFragment;

  constructor(
    private readonly db: Database,
    private readonly spec: TableSpec<P>,
  ) {
    const aliases = Object.entries<string>(spec.columns).map(
      ([prop, column]) => `${column} as "${prop}"`,
    );
    this.select = sql.raw(`select id, ${aliases.join(", ")} from ${spec.table}`);
  }

  async findById(id: string): Promise<CatalogItem<P> | null> {
    const row = await this.db.maybeOne<P>(sql`${this.select} where id = ${id}`);
    return row ? CatalogItem.restore(row) : null;
  }

  async create(data: Omit<P, "id">): Promise<CatalogItem<P>> {
    const entries = this.entries(data as Partial<P>);
    const { id } = await translateConstraintErrors(
      () =>
        this.db.one<{ id: string }>(sql`
          insert into ${sql.raw(this.spec.table)} (${sql.raw(entries.map(([c]) => c).join(", "))})
          values (${sql.join(entries.map(([, v]) => v))})
          returning id
        `),
      this.spec.errors,
    );
    return (await this.findById(id)) as CatalogItem<P>;
  }

  async save(item: CatalogItem<P>): Promise<void> {
    const { id, ...rest } = item.toState();
    const sets = this.entries(rest as Partial<P>).map(([c, v]) => sql`${sql.raw(c)} = ${v}`);
    await translateConstraintErrors(
      () =>
        this.db.query(
          sql`update ${sql.raw(this.spec.table)} set ${sql.join(sets)} where id = ${id}`,
        ),
      this.spec.errors,
    );
  }

  async delete(id: string): Promise<void> {
    await translateInUseError(
      () => this.db.query(sql`delete from ${sql.raw(this.spec.table)} where id = ${id}`),
      () => new ConflictError(this.spec.inUseMessage),
    );
  }

  private entries(data: Partial<P>): [string, unknown][] {
    const json = new Set<PropertyKey>(this.spec.jsonColumns ?? []);
    return Object.entries<string>(this.spec.columns)
      .filter(([prop]) => data[prop as keyof P] !== undefined)
      .map(([prop, column]) => {
        const value = data[prop as keyof P];
        return [column, json.has(prop) ? sql`${JSON.stringify(value)}::jsonb` : value];
      });
  }
}

export const floorRepository = (db: Database) =>
  new PgCatalogRepository<FloorProps>(db, {
    table: "directory.floors",
    columns: { level: "level", label: "label", shortLabel: "short_label", layout: "layout" },
    jsonColumns: ["layout"],
    errors: { floors_level_key: () => new ConflictError("Já existe um andar com esse nível") },
    inUseMessage: "Este andar tem lojas ou eventos. Mova-os antes de apagar.",
  });

export const blockRepository = (db: Database) =>
  new PgCatalogRepository<BlockProps>(db, {
    table: "directory.blocks",
    columns: { name: "name", sortOrder: "sort_order" },
    errors: { blocks_name_key: () => new ConflictError("Já existe um bloco com esse nome") },
    inUseMessage: "Este bloco tem lojas. Mova-as antes de apagar.",
  });

export const storeCategoryRepository = (db: Database) =>
  new PgCatalogRepository<StoreCategoryProps>(db, {
    table: "directory.store_categories",
    columns: { name: "name", kind: "kind", icon: "icon", sortOrder: "sort_order" },
    errors: {
      store_categories_name_kind_key: () =>
        new ConflictError("Já existe uma categoria com esse nome"),
    },
    inUseMessage: "Esta categoria tem lojas. Mude a categoria delas antes de apagar.",
  });

export const mapPointRepository = (db: Database) =>
  new PgCatalogRepository<MapPointProps>(db, {
    table: "directory.map_points",
    columns: { floorId: "floor_id", icon: "icon", label: "label", x: "x", y: "y" },
    errors: {
      map_points_floor_id_fkey: () => ValidationError.field("floorId", FLOOR_NOT_FOUND),
    },
    inUseMessage: "Ponto em uso",
  });

/* Lojas ------------------------------------------------------------------ */

interface StoreRow {
  id: string;
  slug: string;
  name: string;
  category_id: string;
  extra_category_ids: string[];
  block_id: string;
  floor_id: string;
  description: string;
  icon: string;
  brand_color: string;
  cover_image_url: string | null;
  logo_url: string | null;
  phone: string | null;
  whatsapp: string | null;
  instagram: string | null;
  website: string | null;
  map_x: number | null;
  map_y: number | null;
  status: "active" | "inactive";
  hours: DailyHours[];
}

const SLUG_TAKEN = "Já existe uma loja com esse endereço (slug)";
const STORE_ERRORS: ConstraintErrors = {
  stores_slug_key: () => new ConflictError(SLUG_TAKEN, { slug: [SLUG_TAKEN] }),
};

function storeToDomain(r: StoreRow): Store {
  return Store.restore({
    id: r.id,
    slug: r.slug,
    name: r.name,
    categoryId: r.category_id,
    extraCategoryIds: r.extra_category_ids,
    blockId: r.block_id,
    floorId: r.floor_id,
    description: r.description,
    icon: r.icon,
    brandColor: r.brand_color,
    coverImageUrl: r.cover_image_url,
    logoUrl: r.logo_url,
    phone: r.phone,
    whatsapp: r.whatsapp,
    instagram: r.instagram,
    website: r.website,
    mapX: r.map_x,
    mapY: r.map_y,
    status: r.status,
    hours: r.hours,
  });
}

export class PgStoreRepository implements StoreRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<Store | null> {
    const row = await this.db.maybeOne<StoreRow>(sql`
      select s.id, s.slug, s.name, s.category_id, s.block_id, s.floor_id, s.description, s.icon,
             s.brand_color, s.cover_image_url, s.logo_url, s.phone, s.whatsapp, s.instagram,
             s.website, s.map_x, s.map_y, s.status,
             array(select x.category_id from directory.store_extra_categories x
                   where x.store_id = s.id order by x.created_at, x.category_id) as extra_category_ids,
             ${STORE_HOURS_JSON} as hours
      from directory.stores s
      where s.id = ${id}
      for update of s
    `);
    return row ? storeToDomain(row) : null;
  }

  async slugsStartingWith(base: string): Promise<Set<string>> {
    const rows = await this.db.many<{ slug: string }>(sql`
      select slug from directory.stores where slug = ${base} or slug like ${`${escapeLike(base)}-%`}
    `);
    return new Set(rows.map((r) => r.slug));
  }

  async create(data: NewStore): Promise<Store> {
    const { id } = await translateConstraintErrors(
      () =>
        this.db.one<{ id: string }>(sql`
          insert into directory.stores
            (slug, name, category_id, block_id, floor_id, description, icon, brand_color,
             cover_image_url, logo_url, phone, whatsapp, instagram, website, map_x, map_y, status)
          values
            (${data.slug}, ${data.name}, ${data.categoryId}, ${data.blockId}, ${data.floorId},
             ${data.description}, ${data.icon}, ${data.brandColor}, ${data.coverImageUrl},
             ${data.logoUrl}, ${data.phone}, ${data.whatsapp}, ${data.instagram}, ${data.website},
             ${data.mapX}, ${data.mapY}, ${data.status})
          returning id
        `),
      STORE_ERRORS,
    );
    await this.replaceHours(id, data.hours);
    await this.replaceExtraCategories(id, data.extraCategoryIds);
    return (await this.findById(id)) as Store;
  }

  async save(store: Store): Promise<void> {
    const s: StoreProps = store.toState();
    await translateConstraintErrors(
      () =>
        this.db.query(sql`
          update directory.stores
          set slug = ${s.slug}, name = ${s.name}, category_id = ${s.categoryId},
              block_id = ${s.blockId}, floor_id = ${s.floorId}, description = ${s.description},
              icon = ${s.icon}, brand_color = ${s.brandColor}, cover_image_url = ${s.coverImageUrl},
              logo_url = ${s.logoUrl}, phone = ${s.phone}, whatsapp = ${s.whatsapp},
              instagram = ${s.instagram}, website = ${s.website}, map_x = ${s.mapX},
              map_y = ${s.mapY}, status = ${s.status}
          where id = ${s.id}
        `),
      STORE_ERRORS,
    );
    await this.replaceHours(s.id, s.hours);
    await this.replaceExtraCategories(s.id, s.extraCategoryIds);
  }

  private async replaceExtraCategories(storeId: string, ids: readonly string[]): Promise<void> {
    await this.db.query(
      sql`delete from directory.store_extra_categories where store_id = ${storeId}`,
    );
    if (ids.length === 0) return;
    const values = ids.map((id) => sql`(${storeId}, ${id})`);
    await this.db.query(sql`
      insert into directory.store_extra_categories (store_id, category_id)
      values ${sql.join(values)}
    `);
  }

  private async replaceHours(storeId: string, hours: readonly DailyHours[]): Promise<void> {
    await this.db.query(sql`delete from directory.store_hours where store_id = ${storeId}`);
    if (hours.length === 0) return;
    const values = hours.map(
      (h) => sql`(${storeId}, ${h.weekday}, ${h.opensAt}::time, ${h.closesAt}::time)`,
    );
    await this.db.query(sql`
      insert into directory.store_hours (store_id, weekday, opens_at, closes_at)
      values ${sql.join(values)}
    `);
  }
}

export class PgDirectoryReferences implements DirectoryReferences {
  constructor(private readonly db: Database) {}

  async missing(refs: StoreRefs) {
    const extras = [...new Set(refs.extraCategoryIds ?? [])];
    const row = await this.db.one<{
      category: boolean;
      extras: boolean;
      block: boolean;
      floor: boolean;
    }>(sql`
      select
        (select count(*) from directory.store_categories
          where id = any(${extras}::uuid[])) = ${extras.length} as extras,
        ${refs.categoryId ?? null}::uuid is null
          or exists (select 1 from directory.store_categories where id = ${refs.categoryId ?? null}::uuid) as category,
        ${refs.blockId ?? null}::uuid is null
          or exists (select 1 from directory.blocks where id = ${refs.blockId ?? null}::uuid) as block,
        ${refs.floorId ?? null}::uuid is null
          or exists (select 1 from directory.floors where id = ${refs.floorId ?? null}::uuid) as floor
    `);
    const missing: string[] = [];
    if (!row.category) missing.push("categoryId");
    if (!row.extras) missing.push("extraCategoryIds");
    if (!row.block) missing.push("blockId");
    if (!row.floor) missing.push("floorId");
    return missing;
  }
}

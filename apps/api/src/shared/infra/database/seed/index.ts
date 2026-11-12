import { appSettingsSchema, PERMISSIONS } from "@arp/contracts";
import { hash } from "@node-rs/argon2";
import { loadDatabaseEnv, loadSeedEnv } from "../../infra-env";
import { consoleLogger, isCliEntry, runCli } from "../cli";
import { Database, type DatabaseLogger } from "../database";
import { type SqlFragment, sql } from "../sql";
import { ADMIN_USER, EVENT_CATEGORIES, FLOORS, ROLES, SEALS, SETTINGS } from "./catalog";
import { ART_POINTS, CONTENT_PAGES, RECYCLING_ITEMS } from "./content";
import { purgeLegacyDemo } from "./legacy-demo";
import { SITE_BLOCKS, SITE_STORE_CATEGORIES, SITE_STORES } from "./site-data";

/*
 * Seed idempotente: cargos, admin, configurações, textos, selos e o catálogo
 * real do site da ARP (lojas, blocos e categorias). Não sobrescreve o que foi
 * editado no painel, e o catálogo de lojas entra uma vez só: loja apagada no
 * painel não volta na próxima subida. Eventos vêm do site, pelo "Sincronizar
 * com o site" em Integrações.
 */

const SEED_LOCK_KEY = 7_310_528_605;

export interface SeedDeps {
  db: Database;
  /** Hash de senha (use o PasswordHasher da API para os mesmos parâmetros). Padrão: argon2id. */
  hashPassword?: (plain: string) => Promise<string>;
  logger?: DatabaseLogger;
}

export interface SeedOptions {
  adminPassword: string;
}

export interface SeedReport {
  /** Linhas por tabela depois do seed. */
  counts: Record<string, number>;
  /** true se as lojas do site entraram nesta execução. */
  catalogSeeded: boolean;
}

/** argon2id com os parâmetros mínimos recomendados pela OWASP (19 MiB, t=2, p=1). */
export const defaultHashPassword = (plain: string) =>
  hash(plain, { algorithm: 2 /* Argon2id */, memoryCost: 19_456, timeCost: 2, parallelism: 1 });

export async function runSeed(deps: SeedDeps, options: SeedOptions): Promise<SeedReport> {
  const { db, logger } = deps;
  const adminHash = await (deps.hashPassword ?? defaultHashPassword)(options.adminPassword);

  const catalogSeeded = await db.transaction(async () => {
    // Duas réplicas com SEED_ON_START não semeiam ao mesmo tempo.
    await db.query(sql`select pg_advisory_xact_lock(${SEED_LOCK_KEY}::bigint)`);
    await purgeLegacyDemo(db, SITE_STORE_CATEGORIES, logger);
    const seeder = new Seeder(db);
    await seeder.roles();
    await seeder.settings();
    await seeder.content();
    await seeder.admin(adminHash);
    await seeder.seals();
    await seeder.eventCategories();
    return seeder.directory();
  });

  const counts = await countRows(db);
  logger?.info({}, catalogSeeded ? "Seed concluído (lojas do site gravadas)" : "Seed concluído");
  return { counts, catalogSeeded };
}

/* Inserção idempotente --------------------------------------------------- */

type Row = Record<string, unknown>;

class Seeder {
  constructor(private readonly db: Database) {}

  /** id da linha com a chave; insere com `values` se não existir. */
  private async ensure(table: string, key: Row, values: Row = {}): Promise<string> {
    const where = sql.and(
      Object.entries(key).map(([column, value]) =>
        value === null
          ? sql`${sql.identifier(column)} is null`
          : sql`${sql.identifier(column)} = ${value}`,
      ),
    );
    const found = await this.db.maybeOne<{ id: string }>(
      sql`select id from ${sql.identifier(table)} where ${where}`,
    );
    if (found) return found.id;
    const row = await this.db.one<{ id: string }>(
      sql`${insertInto(table, [{ ...key, ...values }])} returning id`,
    );
    return row.id;
  }

  async roles(): Promise<void> {
    for (const role of ROLES) {
      await this.ensure(
        "identity.roles",
        { name: role.name },
        {
          description: role.description,
          permissions: [...role.permissions],
          is_system: role.isSystem,
        },
      );
    }
    // Cargo do sistema acompanha o catálogo: permissão nova no contrato chega ao admin.
    await this.db.query(sql`
      update identity.roles set permissions = ${[...PERMISSIONS]}
      where is_system and not (permissions @> ${[...PERMISSIONS]}::text[])
    `);
  }

  /** Valor nunca salvo pelo painel (updated_by nulo) acompanha o seed. */
  async settings(): Promise<void> {
    const values = appSettingsSchema.parse(SETTINGS);
    for (const [key, value] of Object.entries(values)) {
      await this.db.query(sql`
        insert into platform.settings (key, value) values (${key}, ${JSON.stringify(value)}::jsonb)
        on conflict (key) do update set value = excluded.value
        where platform.settings.updated_by is null
      `);
    }
  }

  /** Textos, Circuito Cultural e Sustentarp. O que a ARP editou no painel fica. */
  async content(): Promise<void> {
    for (const page of CONTENT_PAGES) {
      await this.db.query(sql`
        insert into content.pages (key, title, body) values (${page.key}, ${page.title}, ${page.body})
        on conflict (key) do update set title = excluded.title, body = excluded.body
        where content.pages.updated_by is null
      `);
    }
    // Ponto ainda sem descrição (do seed antigo) recebe os dados do site.
    for (const p of ART_POINTS) {
      await this.db.query(sql`
        insert into content.art_points (number, name, artist, place, kind, description, image_url, map_x, map_y)
        values (${p.number}, ${p.name}, ${p.artist}, ${p.place}, ${p.kind}, ${p.description},
                ${p.imageUrl}, ${p.mapX}, ${p.mapY})
        on conflict (number) do update set
          name = excluded.name, artist = excluded.artist, kind = excluded.kind,
          description = excluded.description, image_url = excluded.image_url
        where content.art_points.description = ''
      `);
    }
    for (const [i, item] of RECYCLING_ITEMS.entries()) {
      await this.ensure(
        "content.recycling_items",
        { name: item.name },
        {
          icon: item.icon,
          accepts: item.accepts,
          rejects: item.rejects,
          becomes: item.becomes,
          gives_seal: item.givesSeal ?? false,
          sort_order: i + 1,
        },
      );
    }
  }

  async admin(passwordHash: string): Promise<void> {
    const roleId = await this.ensure("identity.roles", { name: "Administrador" });
    // Senha só na criação: re-rodar o seed não desfaz uma troca de senha.
    await this.db.query(sql`
      insert into identity.users (name, email, password_hash, role_id, status, must_change_password)
      values (${ADMIN_USER.name}, ${ADMIN_USER.email}, ${passwordHash}, ${roleId}, 'active', false)
      on conflict (lower(email)) do nothing
    `);
  }

  async seals(): Promise<void> {
    for (const [i, seal] of SEALS.entries()) {
      await this.ensure(
        "gamification.seals",
        { slug: seal.slug },
        {
          name: seal.name,
          description: seal.description,
          icon: seal.icon,
          gradient_from: seal.from,
          gradient_to: seal.to,
          sort_order: i + 1,
          status: "archived" in seal ? "archived" : "active",
          // Evento pode ser ganho de novo (um por código).
          repeatable: seal.slug === "agito",
        },
      );
    }
  }

  async eventCategories(): Promise<void> {
    for (const cat of EVENT_CATEGORIES) {
      await this.ensure(
        "agenda.event_categories",
        { name: cat.name },
        { icon: cat.icon, sort_order: cat.sortOrder },
      );
    }
  }

  /** Andar, blocos, categorias e lojas do site: só na primeira vez. */
  async directory(): Promise<boolean> {
    const floors = new Map<number, string>();
    for (const floor of FLOORS) {
      const id = await this.ensure(
        "directory.floors",
        { level: floor.level },
        { label: floor.label, short_label: floor.shortLabel },
      );
      floors.set(floor.level, id);
    }

    const already = await this.db.maybeOne(sql`
      select 1 from directory.stores where slug = any(${SITE_STORES.map((s) => s.slug)}::text[]) limit 1
    `);
    if (already) return false;

    const blocks = new Map<string, string>();
    for (const block of SITE_BLOCKS) {
      blocks.set(
        block.name,
        await this.ensure(
          "directory.blocks",
          { name: block.name },
          { sort_order: block.sortOrder },
        ),
      );
    }
    const categories = new Map<string, string>();
    for (const cat of SITE_STORE_CATEGORIES) {
      categories.set(
        `${cat.kind}:${cat.name}`,
        await this.ensure(
          "directory.store_categories",
          { name: cat.name, kind: cat.kind },
          { icon: cat.icon, sort_order: cat.sortOrder },
        ),
      );
    }
    const floorId = floors.get(0);
    for (const store of SITE_STORES) {
      const id = await this.ensure(
        "directory.stores",
        { slug: store.slug },
        {
          name: store.name,
          category_id: categories.get(`${store.kind}:${store.category}`),
          block_id: blocks.get(store.block),
          floor_id: floorId,
          description: store.description,
          icon: store.icon,
          brand_color: store.brandColor,
          cover_image_url: store.imageUrl,
          phone: store.phone,
          whatsapp: store.whatsapp,
          instagram: store.instagram,
          status: "active",
        },
      );
      const hours = store.hours.flatMap(([weekdays, opens, closes]) =>
        weekdays.map((weekday) => ({ store_id: id, weekday, opens_at: opens, closes_at: closes })),
      );
      if (hours.length > 0) await this.db.query(insertInto("directory.store_hours", hours));
      const extras = store.extraCategories.map(([kind, name]) => ({
        store_id: id,
        category_id: categories.get(`${kind}:${name}`),
      }));
      if (extras.length > 0) {
        await this.db.query(insertInto("directory.store_extra_categories", extras));
      }
    }
    return true;
  }
}

/** insert into <tabela> (colunas) values (...), (...) — colunas da primeira linha. */
function insertInto(table: string, rows: Row[]): SqlFragment {
  const first = rows[0];
  if (!first) throw new Error("insertInto sem linhas");
  const columns = Object.keys(first);
  const values = rows.map((row) => sql`(${sql.join(columns.map((c) => row[c]))})`);
  return sql`insert into ${sql.identifier(table)} (${sql.join(columns.map((c) => sql.identifier(c)))}) values ${sql.join(values)}`;
}

/* Contagens -------------------------------------------------------------- */

const COUNTED_TABLES = [
  "identity.roles",
  "identity.users",
  "directory.floors",
  "directory.blocks",
  "directory.store_categories",
  "directory.stores",
  "directory.store_hours",
  "visitors.visitors",
  "promotions.coupons",
  "agenda.event_categories",
  "agenda.events",
  "gamification.seals",
  "gamification.challenges",
  "gamification.prizes",
  "marketing.highlights",
  "content.art_points",
  "content.recycling_items",
  "platform.settings",
] as const;

async function countRows(db: Database): Promise<Record<string, number>> {
  const parts = COUNTED_TABLES.map(
    (t) => sql`select ${t} as table_name, count(*)::int as n from ${sql.identifier(t)}`,
  );
  const rows = await db.many<{ table_name: string; n: number }>(sql.join(parts, " union all "));
  return Object.fromEntries(rows.map((r) => [r.table_name, r.n]));
}

/* CLI -------------------------------------------------------------------- */

async function main(): Promise<void> {
  const dbEnv = loadDatabaseEnv();
  const seedEnv = loadSeedEnv();
  const db = new Database({
    connectionString: dbEnv.DATABASE_URL,
    ssl: dbEnv.DB_SSL,
    ...(dbEnv.DB_SSL_CA ? { sslCa: dbEnv.DB_SSL_CA } : {}),
    poolMax: 2,
    statementTimeoutMs: 0,
    applicationName: "arp-seed",
    logger: consoleLogger,
  });
  try {
    const report = await runSeed(
      { db, logger: consoleLogger },
      { adminPassword: seedEnv.SEED_ADMIN_PASSWORD },
    );
    console.table(report.counts);
  } finally {
    await db.close();
  }
}
if (isCliEntry(import.meta.url, "seed/index")) runCli(main);

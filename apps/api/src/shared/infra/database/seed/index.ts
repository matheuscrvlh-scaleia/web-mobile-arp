import { createHash, randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { appSettingsSchema, PERMISSIONS } from "@arp/contracts";
import { hash } from "@node-rs/argon2";
import { IMAGE_CACHE_SECONDS, ImageVariants } from "../../../application/image-variants";
import type { ImageProcessor } from "../../../application/ports/images";
import type { Storage } from "../../../application/ports/storage";
import { SharpImageProcessor } from "../../images/sharp-image-processor";
import { loadDatabaseEnv, loadSeedEnv, loadStorageEnv } from "../../infra-env";
import { createStorage } from "../../storage";
import { consoleLogger, isCliEntry, runCli } from "../cli";
import { Database, type DatabaseLogger } from "../database";
import { type SqlFragment, sql } from "../sql";
import { type CampaignInput, type CouponInput, generateActivity } from "./activity";
import {
  BLOCKS,
  CHALLENGES,
  COUPONS,
  DEMO_VISITOR,
  EVENT_CATEGORIES,
  EVENTS,
  FLOORS,
  MAP_POINTS,
  ROLES,
  SEALS,
  SETTINGS,
  STORE_CATEGORIES,
  STORES,
  TIERS,
  USERS,
  type When,
} from "./catalog";
import { ART_POINTS, CONTENT_PAGES, JOBS, RECYCLING_ITEMS } from "./content";
import { Random } from "./random";
import { addDays, createSeedClock, HOUR_MS, type SeedClock, weekdayOf, zoned } from "./time";

/*
 * Seed idempotente: insere o que falta pela chave natural (slug, nome,
 * e-mail, level…) e NUNCA sobrescreve o que já existe — é seguro rodar a cada
 * subida (SEED_ON_START) sem desfazer edições feitas pelo painel.
 *
 * A atividade sintética (visitantes, cupons pegos, selos, leituras…) é gerada
 * de uma vez só, na primeira execução (quando a visitante de demonstração
 * ainda não existe), com PRNG de semente fixa e datas relativas a hoje em
 * America/Sao_Paulo.
 */

const SEED = 20_261_101;
const SEED_LOCK_KEY = 7_310_528_605;
const SYNTHETIC_VISITORS = 60;
const DAYS_PT = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

export interface SeedDeps {
  db: Database;
  storage: Storage;
  /** Hash de senha (use o PasswordHasher da API para os mesmos parâmetros). Padrão: argon2id. */
  hashPassword?: (plain: string) => Promise<string>;
  logger?: DatabaseLogger;
  /** Pasta das imagens; padrão: apps/api/seed-assets. */
  assetsDir?: string;
  /** Gera as miniaturas das imagens; padrão: sharp. */
  images?: ImageProcessor;
  /** "Agora" do seed (testes). */
  now?: Date;
}

export interface SeedOptions {
  adminPassword: string;
  visitorPassword?: string;
  /** false = só cargos, admin e configurações. Padrão true. */
  demo?: boolean;
}

export interface SeedReport {
  /** Linhas por tabela depois do seed. */
  counts: Record<string, number>;
  /** true se a atividade sintética foi gerada nesta execução. */
  activityGenerated: boolean;
}

/** argon2id com os parâmetros mínimos recomendados pela OWASP (19 MiB, t=2, p=1). */
export const defaultHashPassword = (plain: string) =>
  hash(plain, { algorithm: 2 /* Argon2id */, memoryCost: 19_456, timeCost: 2, parallelism: 1 });

export async function runSeed(deps: SeedDeps, options: SeedOptions): Promise<SeedReport> {
  const { db, storage, logger } = deps;
  const demo = options.demo ?? true;
  const hashPassword = deps.hashPassword ?? defaultHashPassword;
  const clock = createSeedClock(deps.now ?? new Date());

  // Fora da transação: hash é CPU e upload é rede (e storage não é transacional).
  const adminHash = await hashPassword(options.adminPassword);
  const visitorHash = demo ? await hashPassword(options.visitorPassword ?? "Visitante123") : "";
  const images = demo
    ? await uploadImages(
        new ImageVariants({ storage, processor: deps.images ?? new SharpImageProcessor() }),
        storage,
        deps.assetsDir ?? findSeedAssetsDir(),
        logger,
      )
    : new Map<string, string>();

  const activityGenerated = await db.transaction(async () => {
    // Duas réplicas com SEED_ON_START não semeiam ao mesmo tempo.
    await db.query(sql`select pg_advisory_xact_lock(${SEED_LOCK_KEY}::bigint)`);
    const seeder = new Seeder(db, clock, images);
    await seeder.roles();
    await seeder.settings();
    await seeder.content();
    if (!demo) {
      await seeder.user(USERS[0] as (typeof USERS)[number], adminHash, null);
      return false;
    }
    await seeder.directory();
    await seeder.users(adminHash);
    await seeder.promotions();
    await seeder.agenda();
    await seeder.gamification();
    await seeder.marketing();
    await seeder.jobs();
    return seeder.activity(visitorHash, logger);
  });

  if (activityGenerated) {
    // Estatísticas do planner atualizadas depois da carga grande.
    for (const table of COUNTED_TABLES) await db.query(sql`analyze ${sql.identifier(table)}`);
  }

  const counts = await countRows(db);
  logger?.info({}, activityGenerated ? "Seed concluído (com atividade)" : "Seed concluído");
  return { counts, activityGenerated };
}

/* Inserção idempotente --------------------------------------------------- */

type Row = Record<string, unknown>;

class Seeder {
  private readonly rng = new Random(SEED);
  private readonly ids = {
    floors: new Map<number, string>(),
    blocks: new Map<string, string>(),
    categories: new Map<string, string>(),
    stores: new Map<string, string>(),
    users: new Map<string, string>(),
    roles: new Map<string, string>(),
    coupons: new Map<string, string>(),
    seals: new Map<string, string>(),
    eventCategories: new Map<string, string>(),
    events: new Map<string, string>(),
    campaigns: [] as CampaignInput[],
  };

  constructor(
    private readonly db: Database,
    private readonly clock: SeedClock,
    private readonly images: Map<string, string>,
  ) {}

  /** id da linha com a chave; insere com `values` se não existir. */
  private async ensure(
    table: string,
    key: Row,
    values: Row = {},
  ): Promise<{ id: string; created: boolean }> {
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
    if (found) return { id: found.id, created: false };
    const row = await this.db.one<{ id: string }>(
      sql`${insertInto(table, [{ ...key, ...values }])} returning id`,
    );
    return { id: row.id, created: true };
  }

  private image(file: string | null): string | null {
    if (!file) return null;
    const url = this.images.get(file);
    if (!url) throw new Error(`Imagem do seed não enviada: ${file}`);
    return url;
  }

  private when(w: When): Date {
    if ("day" in w) return this.clock.at(w.day, w.time);
    if ("monthEnd" in w) return zoned(this.clock.monthEnd(), "23:59");
    if ("hoursAgo" in w) return new Date(this.clock.now.getTime() - w.hoursAgo * HOUR_MS);
    const untilSunday = (7 - weekdayOf(this.clock.today)) % 7;
    return this.clock.at(untilSunday, w.nextSunday);
  }

  /** Data de criação plausível: um pouco antes de algo começar (nunca no futuro). */
  private createdBefore(at: Date, days = 3): Date {
    const t = Math.min(at.getTime(), this.clock.now.getTime()) - days * 24 * HOUR_MS;
    return new Date(t);
  }

  /** Textos, Circuito Cultural e Sustentarp (Fase 2). Não sobrescreve o que a ARP editou. */
  async content(): Promise<void> {
    for (const page of CONTENT_PAGES) {
      await this.db.query(sql`
        insert into content.pages (key, title, body) values (${page.key}, ${page.title}, ${page.body})
        on conflict (key) do nothing
      `);
    }
    for (const [number, name, artist, place, kind, x, y] of ART_POINTS) {
      await this.ensure(
        "content.art_points",
        { number },
        { name, artist, place, kind, map_x: x, map_y: y },
      );
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

  /** Vagas de exemplo (demo), com o WhatsApp da loja. */
  async jobs(): Promise<void> {
    for (const [slug, title, text, daysAgo] of JOBS) {
      const store = STORES.find((s) => s.slug === slug);
      const storeId = this.ids.stores.get(slug);
      if (!store || !storeId) continue;
      const publishedAt = new Date(this.clock.now.getTime() - daysAgo * 24 * HOUR_MS);
      await this.ensure(
        "content.jobs",
        { store_id: storeId, title },
        {
          text,
          whatsapp: `55${(store.whatsapp ?? store.phone ?? "24999999999").replace(/\D/g, "")}`,
          published_at: publishedAt,
          expires_at: new Date(publishedAt.getTime() + 30 * 24 * HOUR_MS),
        },
      );
    }
  }

  async roles(): Promise<void> {
    for (const role of ROLES) {
      const { id } = await this.ensure(
        "identity.roles",
        { name: role.name },
        {
          description: role.description,
          permissions: [...role.permissions],
          is_system: role.isSystem,
        },
      );
      this.ids.roles.set(role.name, id);
    }
    // Cargo do sistema acompanha o catálogo: permissão nova no contrato chega ao admin.
    await this.db.query(sql`
      update identity.roles set permissions = ${[...PERMISSIONS]}
      where is_system and not (permissions @> ${[...PERMISSIONS]}::text[])
    `);
  }

  async settings(): Promise<void> {
    const values = appSettingsSchema.parse(SETTINGS);
    for (const [key, value] of Object.entries(values)) {
      await this.db.query(sql`
        insert into platform.settings (key, value) values (${key}, ${JSON.stringify(value)}::jsonb)
        on conflict (key) do nothing
      `);
    }
  }

  async user(
    user: (typeof USERS)[number],
    passwordHash: string,
    storeId: string | null,
  ): Promise<void> {
    const roleId = this.ids.roles.get(user.role);
    if (!roleId) throw new Error(`Cargo ausente: ${user.role}`);
    const lastLogin =
      user.lastLoginHoursAgo === null
        ? null
        : new Date(this.clock.now.getTime() - user.lastLoginHoursAgo * HOUR_MS);
    // Senha só na criação: re-rodar o seed não desfaz uma troca de senha.
    await this.db.query(sql`
      insert into identity.users
        (name, email, password_hash, role_id, store_id, status, must_change_password, last_login_at, created_at, updated_at)
      values
        (${user.name}, ${user.email}, ${passwordHash}, ${roleId}, ${storeId}, 'active', false, ${lastLogin},
         ${this.clock.at(-200, "09:00")}, ${this.clock.at(-200, "09:00")})
      on conflict (lower(email)) do nothing
    `);
    const row = await this.db.one<{ id: string }>(
      sql`select id from identity.users where lower(email) = lower(${user.email})`,
    );
    this.ids.users.set(user.key, row.id);
  }

  async users(passwordHash: string): Promise<void> {
    for (const user of USERS) {
      const storeId = user.storeSlug ? (this.ids.stores.get(user.storeSlug) ?? null) : null;
      await this.user(user, passwordHash, storeId);
    }
  }

  async directory(): Promise<void> {
    const createdAt = this.clock.at(-210, "10:00");
    for (const floor of FLOORS) {
      const { id } = await this.ensure(
        "directory.floors",
        { level: floor.level },
        {
          label: floor.label,
          short_label: floor.shortLabel,
          layout: JSON.stringify(floor.layout),
          created_at: createdAt,
          updated_at: createdAt,
        },
      );
      this.ids.floors.set(floor.level, id);
    }
    for (const block of BLOCKS) {
      const { id } = await this.ensure(
        "directory.blocks",
        { name: block.name },
        { sort_order: block.sortOrder, created_at: createdAt, updated_at: createdAt },
      );
      this.ids.blocks.set(block.name, id);
    }
    for (const cat of STORE_CATEGORIES) {
      const { id } = await this.ensure(
        "directory.store_categories",
        { name: cat.name, kind: cat.kind },
        { icon: cat.icon, sort_order: cat.sortOrder, created_at: createdAt, updated_at: createdAt },
      );
      this.ids.categories.set(`${cat.kind}:${cat.name}`, id);
    }
    for (const store of STORES) {
      const { id, created } = await this.ensure(
        "directory.stores",
        { slug: store.slug },
        {
          name: store.name,
          category_id: this.ids.categories.get(`${store.kind}:${store.category}`),
          block_id: this.ids.blocks.get(store.block),
          floor_id: this.ids.floors.get(store.level),
          description: store.description,
          icon: store.icon,
          brand_color: store.brandColor,
          cover_image_url: this.image(store.image),
          phone: store.phone,
          whatsapp: store.whatsapp,
          instagram: store.instagram,
          map_x: store.mapX,
          map_y: store.mapY,
          status: "active",
          created_at: createdAt,
          updated_at: createdAt,
        },
      );
      this.ids.stores.set(store.slug, id);
      // Horários só junto com a loja nova: são editados pelo painel depois.
      if (created) {
        const hours = store.hours.flatMap(([weekdays, opens, closes]) =>
          weekdays.map((weekday) => ({
            store_id: id,
            weekday,
            opens_at: opens,
            closes_at: closes,
          })),
        );
        await this.db.query(insertInto("directory.store_hours", hours));
        const extras = (store.extraCategories ?? []).map(([kind, name]) => ({
          store_id: id,
          category_id: this.ids.categories.get(`${kind}:${name}`),
        }));
        if (extras.length > 0) {
          await this.db.query(insertInto("directory.store_extra_categories", extras));
        }
      }
    }
    for (const point of MAP_POINTS) {
      await this.ensure(
        "directory.map_points",
        { floor_id: this.ids.floors.get(point.level), label: point.label },
        { icon: point.icon, x: point.x, y: point.y, created_at: createdAt, updated_at: createdAt },
      );
    }
  }

  async promotions(): Promise<void> {
    for (const c of COUPONS) {
      const storeId = this.ids.stores.get(c.storeSlug);
      const startsAt = this.when(c.startsAt);
      const createdAt = this.createdBefore(startsAt, 2);
      const { id } = await this.ensure(
        "promotions.coupons",
        { store_id: storeId, title: c.title },
        {
          headline: c.headline,
          headline_sub: c.headlineSub,
          description: c.description,
          schedule_note: c.scheduleNote,
          starts_at: startsAt,
          ends_at: c.endsAt ? this.when(c.endsAt) : null,
          total_quantity: c.totalQuantity,
          redeem_window_hours: c.redeemWindowHours,
          tone: c.tone,
          icon: c.icon,
          image_url: this.image(c.image),
          savings_cents: c.savingsCents,
          status: c.status,
          created_by:
            c.storeSlug === "casa-brava"
              ? this.ids.users.get("merchant")
              : this.ids.users.get("marketing"),
          created_at: createdAt,
          updated_at: createdAt,
        },
      );
      this.ids.coupons.set(c.ref, id);
    }
  }

  async agenda(): Promise<void> {
    const createdAt = this.clock.at(-200, "10:00");
    for (const cat of EVENT_CATEGORIES) {
      const { id } = await this.ensure(
        "agenda.event_categories",
        { name: cat.name },
        { icon: cat.icon, sort_order: cat.sortOrder, created_at: createdAt, updated_at: createdAt },
      );
      this.ids.eventCategories.set(cat.name, id);
    }
    for (const e of EVENTS) {
      const startsOn =
        e.startsOn === "monthStart"
          ? this.clock.monthStart()
          : addDays(this.clock.today, e.startsOn);
      const endsOn =
        e.endsOn === null
          ? null
          : e.endsOn === "monthEnd"
            ? this.clock.monthEnd()
            : addDays(this.clock.today, e.endsOn);
      const created = this.createdBefore(zoned(startsOn, "09:00"), 10);
      const { id } = await this.ensure(
        "agenda.events",
        { title: e.title },
        {
          category_id: this.ids.eventCategories.get(e.category),
          description: e.description,
          image_url: this.image(e.image),
          tone: e.tone,
          icon: e.icon,
          place: e.place,
          floor_id: e.level === null ? null : this.ids.floors.get(e.level),
          store_id: e.storeSlug ? this.ids.stores.get(e.storeSlug) : null,
          recurrence: e.recurrence,
          starts_on: startsOn,
          ends_on: endsOn,
          weekday: e.weekday,
          start_time: e.startTime,
          end_time: e.endTime,
          is_long_running: e.isLongRunning,
          awards_seal: e.awardsSeal,
          status: e.status,
          created_at: created,
          updated_at: created,
        },
      );
      this.ids.events.set(e.title, id);
    }
  }

  async gamification(): Promise<void> {
    const createdAt = this.clock.at(-200, "10:00");
    for (const [i, seal] of SEALS.entries()) {
      const { id } = await this.ensure(
        "gamification.seals",
        { slug: seal.slug },
        {
          name: seal.name,
          description: seal.description,
          icon: seal.icon,
          gradient_from: seal.from,
          gradient_to: seal.to,
          sort_order: i + 1,
          status: "active",
          created_at: createdAt,
          updated_at: createdAt,
        },
      );
      this.ids.seals.set(seal.slug, id);
    }

    // Mês corrente no ar, o anterior encerrado e o retrasado arquivado.
    for (const offset of [0, -1, -2]) {
      const startsAt = zoned(this.clock.monthStart(offset), "00:00");
      const endsAt = zoned(this.clock.monthEnd(offset), "23:59");
      const label = this.clock.monthLabel(offset);
      const created = this.createdBefore(startsAt, 5);
      const { id: campaignId } = await this.ensure(
        "gamification.campaigns",
        { name: `Desafios de ${label}`, starts_at: startsAt },
        {
          description: `Cumpra os desafios de ${label}, junte selos e libere benefícios.`,
          ends_at: endsAt,
          status: offset === -2 ? "archived" : "published",
          created_at: created,
          updated_at: created,
        },
      );
      for (const tier of TIERS) {
        await this.ensure(
          "gamification.reward_tiers",
          { campaign_id: campaignId, threshold: tier.threshold },
          { label: tier.label, icon: tier.icon },
        );
      }

      const challenges = CHALLENGES.filter((c) => offset === 0 || c.ref !== "cultural");
      const inputs: CampaignInput["challenges"] = [];
      for (const [i, ch] of challenges.entries()) {
        const sealId = this.ids.seals.get(ch.seal) as string;
        const { id: challengeId } = await this.ensure(
          "gamification.challenges",
          { campaign_id: campaignId, title: ch.title },
          {
            seal_id: sealId,
            how_to: ch.howTo,
            icon: ch.icon,
            validation: ch.validation,
            store_id: ch.storeSlug ? this.ids.stores.get(ch.storeSlug) : null,
            event_id: ch.eventTitle && offset === 0 ? this.ids.events.get(ch.eventTitle) : null,
            sort_order: i + 1,
            status: "active",
            created_at: created,
            updated_at: created,
          },
        );
        const qrCodeIds: string[] = [];
        for (const label of ch.qrLabels) {
          const { id } = await this.ensure(
            "gamification.qr_codes",
            { challenge_id: challengeId, label },
            {
              // Token de verdade (crypto): quem conhece a semente do seed não adivinha.
              token: randomBytes(18).toString("base64url"),
              status: "active",
              created_at: created,
              updated_at: created,
            },
          );
          qrCodeIds.push(id);
        }
        inputs.push({
          id: challengeId,
          ref: ch.ref,
          sealId,
          validation: ch.validation,
          qrCodeIds,
          popularity: ch.popularity,
        });
      }
      this.ids.campaigns.push({
        id: campaignId,
        monthOffset: offset,
        startsAt,
        endsAt,
        challenges: inputs,
      });
    }
  }

  async marketing(): Promise<void> {
    const c = this.clock;
    const marketingUser = this.ids.users.get("marketing");
    const jazzDay = addDays(c.today, 2);
    const highlights: Row[] = [
      {
        title: "Corredor Cultural",
        subtitle: "Música, arte e dança nas ruas da ARP durante todo o mês.",
        cta_label: "Ver programação",
        image_url: this.image("festa.webp"),
        badge: "featured",
        target_type: "event",
        target_id: this.ids.events.get("Corredor Cultural"),
        starts_at: zoned(c.monthStart(), "00:00"),
        ends_at: zoned(c.monthEnd(), "23:59"),
        sort_order: 1,
        status: "published",
        impressions: 4820,
        clicks: 391,
      },
      {
        title: "Chopp pela metade na Casa Brava",
        subtitle: "Só hoje · cupons limitados",
        cta_label: "Pegar cupom",
        image_url: null,
        badge: "sponsored",
        target_type: "coupon",
        target_id: this.ids.coupons.get("c1"),
        sponsor_store_id: this.ids.stores.get("casa-brava"),
        starts_at: c.at(0, "00:00"),
        ends_at: c.at(0, "23:00"),
        sort_order: 2,
        status: "published",
        impressions: 1260,
        clicks: 188,
      },
      {
        title: "Jazz no Pátio",
        subtitle: `${capitalize(DAYS_PT[weekdayOf(jazzDay)] as string)}, 19h na praça central. Entrada livre.`,
        cta_label: "Quero ir",
        image_url: this.image("espaco.webp"),
        badge: "featured",
        target_type: "event",
        target_id: this.ids.events.get("Jazz no Pátio"),
        starts_at: c.at(-1, "08:00"),
        ends_at: c.at(2, "23:00"),
        sort_order: 3,
        status: "published",
        impressions: 930,
        clicks: 74,
      },
      {
        title: "Rodízio de temaki no Kiro",
        subtitle: "Toda quarta no almoço. Reserve pelo app.",
        cta_label: "Ver loja",
        image_url: this.image("kiro.jpg"),
        badge: "sponsored",
        target_type: "store",
        target_id: this.ids.stores.get("kiro-sushi"),
        sponsor_store_id: this.ids.stores.get("kiro-sushi"),
        starts_at: c.at(7, "00:00"),
        ends_at: c.at(21, "23:59"),
        sort_order: 4,
        status: "draft",
        impressions: 0,
        clicks: 0,
      },
      {
        title: "Bem-vindo à nova ARP",
        subtitle: "Lojas, cupons, agenda e desafios num app só.",
        cta_label: null,
        image_url: this.image("fachada.jpg"),
        badge: "featured",
        target_type: "none",
        starts_at: zoned(c.monthStart(-2), "00:00"),
        ends_at: zoned(c.monthEnd(-2), "23:59"),
        sort_order: 5,
        status: "archived",
        impressions: 12_400,
        clicks: 655,
      },
    ];
    for (const h of highlights) {
      const { title, ...values } = h;
      const created = this.createdBefore(values.starts_at as Date, 2);
      await this.ensure(
        "marketing.highlights",
        { title },
        { ...values, created_at: created, updated_at: created },
      );
    }
    // Métricas de demonstração vão para a tabela diária (a API não lê mais as
    // colunas legadas). Só para destaque ainda sem nenhum dia gravado.
    await this.db.query(sql`
      insert into marketing.highlight_daily_metrics (highlight_id, day, impressions, clicks)
      select h.id, (h.created_at at time zone 'America/Sao_Paulo')::date, h.impressions, h.clicks
      from marketing.highlights h
      where (h.impressions > 0 or h.clicks > 0)
        and not exists (select 1 from marketing.highlight_daily_metrics m where m.highlight_id = h.id)
    `);

    const sentPromo = new Date(c.now.getTime() - 6 * HOUR_MS);
    const monthKickoff = new Date(
      Math.min(c.at(0, "10:00").getTime(), zoned(c.monthStart(), "10:00").getTime()),
    );
    const notifications: Row[] = [
      {
        title: "Chopp pela metade hoje na Casa Brava",
        body: "Só hoje, até 23h: chopp de R$ 10 por R$ 5. São só 15 cupons!",
        audience: "store_followers",
        store_id: this.ids.stores.get("casa-brava"),
        deep_link: `arp://cupom/${this.ids.coupons.get("c1")}`,
        scheduled_at: null,
        sent_at: sentPromo,
        status: "sent",
        recipients_count: 14,
        created_at: new Date(sentPromo.getTime() - HOUR_MS),
      },
      {
        title: `Desafios de ${c.monthLabel()} no ar`,
        body: "Novos desafios, novos selos. Junte 3 e ganhe 10% no estacionamento.",
        audience: "opted_in",
        store_id: null,
        deep_link: "arp://desafios",
        scheduled_at: monthKickoff,
        sent_at: monthKickoff,
        status: "sent",
        recipients_count: 38,
        created_at: new Date(monthKickoff.getTime() - 24 * HOUR_MS),
      },
      {
        title: "Jazz no Pátio é depois de amanhã",
        body: "Quarteto de jazz ao ar livre na praça central, às 19h. Entrada livre.",
        audience: "all",
        store_id: null,
        deep_link: `arp://evento/${this.ids.events.get("Jazz no Pátio")}`,
        scheduled_at: c.at(1, "10:00"),
        sent_at: null,
        status: "scheduled",
        recipients_count: 61,
        created_at: new Date(c.now.getTime() - 3 * HOUR_MS),
      },
      {
        title: "Feira de Produtores neste sábado",
        body: "Queijos, cafés e pães da serra, das 9h às 14h na praça central.",
        audience: "opted_in",
        store_id: null,
        deep_link: `arp://evento/${this.ids.events.get("Feira de Produtores")}`,
        scheduled_at: null,
        sent_at: null,
        status: "draft",
        recipients_count: null,
        created_at: new Date(c.now.getTime() - 26 * HOUR_MS),
      },
      {
        title: "Show de rock na praça",
        body: "Sábado tem rock na praça central, a partir das 20h.",
        audience: "all",
        store_id: null,
        deep_link: null,
        scheduled_at: c.at(6, "12:00"),
        sent_at: null,
        status: "cancelled",
        recipients_count: 61,
        created_at: new Date(c.now.getTime() - 50 * HOUR_MS),
      },
    ];
    for (const n of notifications) {
      const { title, created_at, ...values } = n;
      await this.ensure(
        "marketing.push_notifications",
        { title },
        { ...values, created_by: marketingUser, created_at, updated_at: created_at },
      );
    }
  }

  /** Visitantes e tudo o que fizeram. Só na primeira vez. */
  async activity(passwordHash: string, logger?: DatabaseLogger): Promise<boolean> {
    const exists = await this.db.maybeOne(
      sql`select 1 from visitors.visitors where lower(email) = lower(${DEMO_VISITOR.email})`,
    );
    if (exists) {
      logger?.info({}, "Visitantes de demonstração já existem; atividade mantida como está");
      return false;
    }

    const couponRows = await this.db.many<{
      id: string;
      store_id: string;
      kind: "food" | "shop";
      starts_at: Date;
      ends_at: Date | null;
      total_quantity: number;
      redeem_window_hours: number;
      status: string;
    }>(sql`
      select c.id, c.store_id, sc.kind, c.starts_at, c.ends_at, c.total_quantity,
             c.redeem_window_hours, c.status
      from promotions.coupons c
      join directory.stores s on s.id = c.store_id
      join directory.store_categories sc on sc.id = s.category_id
      where c.id = any(${[...this.ids.coupons.values()]}::uuid[])
    `);
    const refById = new Map([...this.ids.coupons].map(([ref, id]) => [id, ref]));
    const coupons: CouponInput[] = couponRows.map((r) => {
      const def = COUPONS.find((c) => c.ref === refById.get(r.id));
      return {
        id: r.id,
        storeId: r.store_id,
        kind: r.kind,
        startsAt: r.starts_at,
        endsAt: r.ends_at,
        totalQuantity: r.total_quantity,
        redeemWindowHours: r.redeem_window_hours,
        status: r.status,
        takenNow: def?.takenNow ?? null,
        demand: def?.demand ?? 0,
      };
    });

    const merchantStore = this.ids.stores.get("casa-brava");
    // "Tenho interesse" só em eventos publicados que ainda vão acontecer.
    const lastDay = (e: (typeof EVENTS)[number]): number =>
      e.recurrence === "weekly" || e.endsOn === "monthEnd"
        ? Number.POSITIVE_INFINITY
        : typeof e.endsOn === "number"
          ? e.endsOn
          : typeof e.startsOn === "number"
            ? e.startsOn
            : 0;
    const interestEventIds = EVENTS.filter((e) => e.status === "published" && lastDay(e) >= 0).map(
      (e) => this.ids.events.get(e.title) as string,
    );

    const activity = generateActivity({
      clock: this.clock,
      rng: this.rng,
      visitorCount: SYNTHETIC_VISITORS,
      passwordHash,
      avatarUrl: this.image(DEMO_VISITOR.avatar),
      stores: [...this.ids.stores].map(([slug, id]) => ({ id, slug })),
      coupons,
      couponIdByRef: this.ids.coupons,
      campaigns: this.ids.campaigns,
      interestEventIds,
      jazzEventId: this.ids.events.get("Jazz no Pátio") ?? null,
      redeemerFor: (storeId) =>
        (storeId === merchantStore
          ? this.ids.users.get("merchant")
          : this.ids.users.get("attendant")) ?? null,
    });

    await this.insertMany("visitors.visitors", activity.visitors);
    await this.insertMany("visitors.push_tokens", activity.pushTokens);
    await this.insertMany("visitors.favorite_stores", activity.favorites);
    await this.insertMany("visitors.store_follows", activity.follows);
    await this.insertMany("agenda.event_interests", activity.interests);
    await this.insertMany("promotions.coupon_claims", activity.claims);
    await this.insertMany("gamification.earned_seals", activity.earnedSeals);
    await this.insertMany("gamification.qr_scans", activity.scans);
    logger?.info(
      {
        visitantes: activity.visitors.length,
        cuponsPegos: activity.claims.length,
        selos: activity.earnedSeals.length,
        leiturasQr: activity.scans.length,
      },
      "Atividade sintética gerada",
    );
    return true;
  }

  private async insertMany(table: string, rows: object[]): Promise<void> {
    // Lotes abaixo do limite de 65535 parâmetros por comando.
    const first = rows[0];
    if (!first) return;
    const perBatch = Math.max(1, Math.floor(30_000 / Object.keys(first).length));
    for (let i = 0; i < rows.length; i += perBatch) {
      await this.db.query(insertInto(table, rows.slice(i, i + perBatch) as Row[]));
    }
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

/* Imagens ---------------------------------------------------------------- */

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

/** Pasta seed-assets em dev (relativa a este arquivo) ou a partir do diretório atual. */
export function findSeedAssetsDir(explicit = process.env.SEED_ASSETS_DIR): string {
  const candidates = [
    explicit,
    fileURLToPath(new URL("../../../../../seed-assets", import.meta.url)),
    path.resolve("seed-assets"),
    path.resolve("apps/api/seed-assets"),
  ].filter((d): d is string => !!d);
  const found = candidates.find((d) => existsSync(d));
  if (!found) throw new Error("Não achei a pasta seed-assets. Defina SEED_ASSETS_DIR.");
  return path.resolve(found);
}

/** Todas as imagens referenciadas pelo catálogo. */
function referencedImages(): string[] {
  const files = new Set<string>([
    DEMO_VISITOR.avatar,
    "festa.webp",
    "espaco.webp",
    "fachada.jpg",
    "kiro.jpg",
  ]);
  for (const s of STORES) files.add(s.image);
  for (const c of COUPONS) if (c.image) files.add(c.image);
  for (const e of EVENTS) if (e.image) files.add(e.image);
  return [...files].sort();
}

/** Pasta lógica no storage, para as chaves ficarem organizadas por tipo. */
function folderFor(file: string): string {
  if (file === DEMO_VISITOR.avatar) return "visitors";
  if (file.startsWith("cp-")) return "coupons";
  if (file.startsWith("ev-") || file === "festa.webp" || file === "espaco.webp") return "events";
  if (file === "fachada.jpg") return "highlights";
  return "stores";
}

/**
 * uuid derivado do conteúdo: a chave segue o padrão dos uploads
 * (<uuid>.<ext>, então tem miniaturas e cache longo) e muda se o arquivo mudar.
 */
export function contentUuid(body: Uint8Array): string {
  const hex = createHash("sha256").update(body).digest("hex");
  const variant = ((Number.parseInt(hex[16] ?? "0", 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Envia as imagens com chave estável (seed/<pasta>/<uuid do conteúdo>.<ext>)
 * e as miniaturas: re-rodar não duplica, e o que já está no storage não é
 * reenviado (só gera a miniatura que faltar).
 */
async function uploadImages(
  variants: ImageVariants,
  storage: Storage,
  dir: string,
  logger?: DatabaseLogger,
): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  let uploaded = 0;
  let thumbnails = 0;
  for (const file of referencedImages()) {
    const ext = path.extname(file).toLowerCase();
    const contentType = MIME_BY_EXT[ext];
    if (!contentType) throw new Error(`Extensão não suportada no seed: ${file}`);
    const body = await readFile(path.join(dir, file));
    const key = `seed/${folderFor(file)}/${contentUuid(body)}${ext}`;
    if (!(await storage.exists(key))) {
      await storage.put(key, body, contentType, { cacheControlSeconds: IMAGE_CACHE_SECONDS });
      uploaded++;
    }
    const result = await variants.ensure(key, async () => body);
    if (result.status === "created") thumbnails += result.created;
    urls.set(file, storage.publicUrl(key));
  }
  logger?.info(
    {},
    `Imagens do seed: ${uploaded} enviada(s), ${urls.size - uploaded} já existiam; ${thumbnails} miniatura(s) gerada(s)`,
  );
  return urls;
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
  "directory.map_points",
  "visitors.visitors",
  "visitors.favorite_stores",
  "visitors.store_follows",
  "visitors.push_tokens",
  "promotions.coupons",
  "promotions.coupon_claims",
  "agenda.event_categories",
  "agenda.events",
  "agenda.event_interests",
  "gamification.seals",
  "gamification.campaigns",
  "gamification.reward_tiers",
  "gamification.challenges",
  "gamification.qr_codes",
  "gamification.earned_seals",
  "gamification.qr_scans",
  "marketing.highlights",
  "marketing.push_notifications",
  "platform.settings",
] as const;

async function countRows(db: Database): Promise<Record<string, number>> {
  const parts = COUNTED_TABLES.map(
    (t) => sql`select ${t} as table_name, count(*)::int as n from ${sql.identifier(t)}`,
  );
  const rows = await db.many<{ table_name: string; n: number }>(sql.join(parts, " union all "));
  return Object.fromEntries(rows.map((r) => [r.table_name, r.n]));
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* CLI -------------------------------------------------------------------- */

async function main(): Promise<void> {
  const dbEnv = loadDatabaseEnv();
  const storageEnv = loadStorageEnv();
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
    const storage = await createStorage(storageEnv);
    const report = await runSeed(
      {
        db,
        storage,
        logger: consoleLogger,
        ...(seedEnv.SEED_ASSETS_DIR ? { assetsDir: seedEnv.SEED_ASSETS_DIR } : {}),
      },
      {
        adminPassword: seedEnv.SEED_ADMIN_PASSWORD,
        visitorPassword: seedEnv.SEED_VISITOR_PASSWORD,
        demo: seedEnv.SEED_DEMO_DATA,
      },
    );
    console.table(report.counts);
  } finally {
    await db.close();
  }
}

if (isCliEntry(import.meta.url, "seed/index")) runCli(main);

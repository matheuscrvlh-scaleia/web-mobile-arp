import { existsSync, statSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadDatabaseEnv } from "../infra-env";
import { consoleLogger, isCliEntry, runCli } from "./cli";
import { Database, type DatabaseLogger } from "./database";
import { sql } from "./sql";

/*
 * Runner de migrations em SQL puro (supabase/migrations/<versão>_<nome>.sql).
 *
 * - Cada arquivo roda numa transação própria: ou entra inteiro, ou nada.
 * - Registra em supabase_migrations.schema_migrations, a MESMA tabela do
 *   Supabase CLI: `supabase db push` e este runner enxergam o mesmo histórico.
 * - pg_advisory_lock garante que só uma réplica migra; as outras esperam e,
 *   ao entrar, não acham nada pendente.
 * - Migration aplicada nunca é editada; mudança = arquivo novo.
 */

const FILE_PATTERN = /^(\d{14})_([a-z0-9_]+)\.sql$/;
/** Chave arbitrária e fixa da trava de migrations (bigint). */
const MIGRATION_LOCK_KEY = 7_310_528_604;

export interface MigrationFile {
  version: string;
  name: string;
  fileName: string;
  content: string;
}

export interface MigrationReport {
  /** Versões aplicadas nesta execução, em ordem. */
  applied: string[];
  /** Quantas já estavam aplicadas. */
  skipped: number;
}

export interface RunMigrationsOptions {
  logger?: DatabaseLogger;
}

/** Lê e ordena os arquivos de migration. Nome fora do padrão é erro (evita arquivo ignorado sem querer). */
export async function readMigrations(dir: string): Promise<MigrationFile[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: MigrationFile[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".sql")) continue;
    const match = FILE_PATTERN.exec(entry.name);
    if (!match) {
      throw new Error(
        `Migration com nome inválido: ${entry.name}. Use AAAAMMDDHHMMSS_nome_em_snake_case.sql`,
      );
    }
    const raw = await readFile(path.join(dir, entry.name), "utf8");
    files.push({
      version: match[1] as string,
      name: match[2] as string,
      fileName: entry.name,
      // BOM e CRLF (checkout no Windows) não podem mudar o conteúdo registrado.
      content: raw.replace(/^﻿/, "").replace(/\r\n/g, "\n"),
    });
  }
  files.sort((a, b) => a.version.localeCompare(b.version));
  for (let i = 1; i < files.length; i++) {
    if (files[i]?.version === files[i - 1]?.version) {
      throw new Error(`Duas migrations com a versão ${files[i]?.version}`);
    }
  }
  return files;
}

/**
 * Acha supabase/migrations subindo pastas a partir do diretório atual e do
 * próprio módulo. Cobre dev (apps/api → raiz do monorepo) e o container
 * (copie supabase/migrations para a raiz da imagem ou defina MIGRATIONS_DIR).
 */
export function findMigrationsDir(explicit?: string): string {
  if (explicit) {
    const dir = path.resolve(explicit);
    if (!isDirectory(dir)) throw new Error(`MIGRATIONS_DIR não existe: ${dir}`);
    return dir;
  }
  const starts = [process.cwd(), path.dirname(fileURLToPath(import.meta.url))];
  for (const start of starts) {
    let current = path.resolve(start);
    while (true) {
      const candidate = path.join(current, "supabase", "migrations");
      if (isDirectory(candidate)) return candidate;
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }
  }
  throw new Error("Não achei supabase/migrations. Defina MIGRATIONS_DIR.");
}

function isDirectory(dir: string): boolean {
  return existsSync(dir) && statSync(dir).isDirectory();
}

const ENSURE_HISTORY_TABLE = sql.raw(`
  create schema if not exists supabase_migrations;
  create table if not exists supabase_migrations.schema_migrations (version text not null primary key);
  alter table supabase_migrations.schema_migrations add column if not exists statements text[];
  alter table supabase_migrations.schema_migrations add column if not exists name text;
`);

interface AppliedRow {
  version: string;
  statements: string[] | null;
}

/** Aplica as migrations pendentes de `dir`. Seguro para rodar em várias réplicas ao mesmo tempo. */
export async function runMigrations(
  db: Database,
  dir: string,
  options: RunMigrationsOptions = {},
): Promise<MigrationReport> {
  const logger = options.logger;
  const files = await readMigrations(dir);

  return db.withConnection(async () => {
    // Esperar a trava e criar índice em tabela grande podem passar do
    // statement_timeout do pool; vale só para esta conexão e é desfeito no fim.
    await db.query(sql`set statement_timeout = 0`);
    const { locked } = await db.one<{ locked: boolean }>(
      sql`select pg_try_advisory_lock(${MIGRATION_LOCK_KEY}::bigint) as locked`,
    );
    if (!locked) {
      logger?.info({}, "Outra instância está migrando; aguardando a trava…");
      await db.query(sql`select pg_advisory_lock(${MIGRATION_LOCK_KEY}::bigint)`);
    }

    try {
      await db.query(ENSURE_HISTORY_TABLE);
      const appliedRows = await db.many<AppliedRow>(
        sql`select version, statements from supabase_migrations.schema_migrations order by version`,
      );
      const applied = new Map(appliedRows.map((r) => [r.version, r]));
      const latestApplied = appliedRows.at(-1)?.version;

      warnAboutDrift(files, applied, logger);

      const report: MigrationReport = { applied: [], skipped: 0 };
      for (const file of files) {
        if (applied.has(file.version)) {
          report.skipped++;
          continue;
        }
        if (latestApplied && file.version < latestApplied) {
          logger?.warn(
            { migration: file.fileName, latestApplied },
            "Migration mais antiga que a última aplicada (fora de ordem); aplicando mesmo assim",
          );
        }
        const started = performance.now();
        await db.transaction(async () => {
          if (file.content.trim()) await db.query(sql.raw(file.content));
          await db.query(sql`
            insert into supabase_migrations.schema_migrations (version, statements, name)
            values (${file.version}, ${[file.content]}, ${file.name})
          `);
        });
        report.applied.push(file.version);
        logger?.info(
          { ms: Math.round(performance.now() - started) },
          `Migration aplicada: ${file.fileName}`,
        );
      }

      if (report.applied.length === 0) logger?.info({}, "Banco já está atualizado");
      return report;
    } finally {
      await db.query(sql`select pg_advisory_unlock(${MIGRATION_LOCK_KEY}::bigint)`);
      await db.query(sql`reset statement_timeout`);
      // A conexão volta ao pool: devolve os timeouts configurados da API.
      await db.restoreSessionSettings();
    }
  });
}

/** Avisa (sem falhar) sobre migration editada depois de aplicada ou ausente do disco. */
function warnAboutDrift(
  files: MigrationFile[],
  applied: Map<string, AppliedRow>,
  logger: DatabaseLogger | undefined,
): void {
  if (!logger) return;
  const onDisk = new Set(files.map((f) => f.version));
  for (const file of files) {
    const row = applied.get(file.version);
    // Registro com 1 statement = gravado por este runner (o CLI separa por comando).
    if (row?.statements?.length === 1 && row.statements[0] !== file.content) {
      logger.warn(
        { migration: file.fileName },
        "Migration alterada depois de aplicada (o banco NÃO foi alterado). Crie uma migration nova.",
      );
    }
  }
  for (const version of applied.keys()) {
    if (!onDisk.has(version)) {
      logger.warn(
        { version },
        "Migration aplicada no banco não existe no disco (versão mais nova?)",
      );
    }
  }
}

/** Situação de cada migration (para `db:migrate -- --status`). */
export async function migrationStatus(
  db: Database,
  dir: string,
): Promise<{ fileName: string; applied: boolean }[]> {
  const files = await readMigrations(dir);
  const exists = await db.one<{ exists: boolean }>(
    sql`select to_regclass('supabase_migrations.schema_migrations') is not null as exists`,
  );
  const applied = exists.exists
    ? new Set(
        (
          await db.many<{ version: string }>(
            sql`select version from supabase_migrations.schema_migrations`,
          )
        ).map((r) => r.version),
      )
    : new Set<string>();
  return files.map((f) => ({ fileName: f.fileName, applied: applied.has(f.version) }));
}

async function main(): Promise<void> {
  const env = loadDatabaseEnv();
  const dir = findMigrationsDir(env.MIGRATIONS_DIR);
  const db = new Database({
    connectionString: env.DATABASE_URL,
    ssl: env.DB_SSL,
    ...(env.DB_SSL_CA ? { sslCa: env.DB_SSL_CA } : {}),
    poolMax: 1,
    statementTimeoutMs: 0,
    applicationName: "arp-migrate",
    logger: consoleLogger,
  });
  try {
    if (process.argv.includes("--status")) {
      for (const m of await migrationStatus(db, dir)) {
        console.log(`${m.applied ? "[x]" : "[ ]"} ${m.fileName}`);
      }
      return;
    }
    consoleLogger.info({}, `Migrations em ${dir}`);
    const report = await runMigrations(db, dir, { logger: consoleLogger });
    consoleLogger.info({}, `${report.applied.length} aplicada(s), ${report.skipped} já existiam`);
  } finally {
    await db.close();
  }
}

if (isCliEntry(import.meta.url, "database/migrate")) runCli(main);

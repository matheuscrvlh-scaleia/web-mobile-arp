import { parseArgs } from "node:util";
import { ImageVariants, imageVariantKeys } from "../../application/image-variants";
import type { ImageProcessor } from "../../application/ports/images";
import type { Storage } from "../../application/ports/storage";
import { consoleLogger, isCliEntry, runCli } from "../database/cli";
import { Database, type DatabaseLogger } from "../database/database";
import { loadDatabaseEnv, loadStorageEnv } from "../infra-env";
import { createStorage } from "../storage";
import { listImageUrls } from "./pg-image-references";
import { SharpImageProcessor } from "./sharp-image-processor";

/*
 * Backfill das miniaturas: percorre as URLs de imagem gravadas no banco
 * (IMAGE_URL_COLUMNS) e gera as que faltam. Idempotente: o que já existe
 * (storage.exists) não é refeito. Uso:
 *   npm run images:thumbnails -w @arp/api [-- --concurrency=4 --dry-run]
 */

export interface BackfillOptions {
  /** Imagens processadas ao mesmo tempo (cada uma decodifica em memória). Padrão 4. */
  concurrency?: number;
  /** Só conta o que falta, sem gerar. */
  dryRun?: boolean;
}

export interface BackfillReport {
  /** URLs distintas no banco. */
  total: number;
  /** Fora deste storage ou sem o padrão <uuid>.<ext>: o app usa a original. */
  skipped: number;
  /** Já tinham todas as miniaturas. */
  complete: number;
  /** Imagens que ganharam miniatura(s) (no dry-run: que precisariam). */
  updated: number;
  /** Miniaturas gravadas (no dry-run: que faltam). */
  thumbnails: number;
  /** URLs cuja original não está no storage. */
  missingOriginal: string[];
  failed: { url: string; error: string }[];
}

export async function backfillImageVariants(
  deps: { db: Database; storage: Storage; processor: ImageProcessor; logger?: DatabaseLogger },
  options: BackfillOptions = {},
): Promise<BackfillReport> {
  const { db, storage, processor, logger } = deps;
  const concurrency = Math.max(1, options.concurrency ?? 4);
  const variants = new ImageVariants({ storage, processor });
  const urls = await listImageUrls(db);
  const report: BackfillReport = {
    total: urls.length,
    skipped: 0,
    complete: 0,
    updated: 0,
    thumbnails: 0,
    missingOriginal: [],
    failed: [],
  };

  const processOne = async (url: string) => {
    const key = storage.keyFromUrl(url);
    if (!key || imageVariantKeys(key).length === 0) {
      report.skipped++;
      return;
    }
    if (options.dryRun) {
      const missing = await variants.missing(key);
      if (missing.length === 0) report.complete++;
      else if (!(await storage.exists(key))) report.missingOriginal.push(url);
      else {
        report.updated++;
        report.thumbnails += missing.length;
      }
      return;
    }
    const result = await variants.ensure(key, () => storage.get(key));
    if (result.status === "complete") report.complete++;
    else if (result.status === "missing-original") report.missingOriginal.push(url);
    else if (result.status === "created") {
      report.updated++;
      report.thumbnails += result.created;
    }
  };

  // Fila simples com N trabalhadores: limita memória (sharp) e conexões com o storage.
  let next = 0;
  const worker = async () => {
    while (next < urls.length) {
      const url = urls[next++] as string;
      try {
        await processOne(url);
      } catch (err) {
        report.failed.push({ url, error: err instanceof Error ? err.message : String(err) });
        logger?.warn({ url, err }, "Falha ao gerar miniaturas");
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, worker));
  return report;
}

/* CLI -------------------------------------------------------------------- */

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      concurrency: { type: "string", default: "4" },
      "dry-run": { type: "boolean", default: false },
    },
  });
  const concurrency = Number.parseInt(values.concurrency, 10);
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error("--concurrency precisa ser um inteiro ≥ 1");
  }
  const dbEnv = loadDatabaseEnv();
  const db = new Database({
    connectionString: dbEnv.DATABASE_URL,
    ssl: dbEnv.DB_SSL,
    ...(dbEnv.DB_SSL_CA ? { sslCa: dbEnv.DB_SSL_CA } : {}),
    poolMax: 2,
    statementTimeoutMs: 0,
    applicationName: "arp-images-backfill",
    logger: consoleLogger,
  });
  try {
    const storage = await createStorage(loadStorageEnv());
    const report = await backfillImageVariants(
      { db, storage, processor: new SharpImageProcessor(), logger: consoleLogger },
      { concurrency, dryRun: values["dry-run"] },
    );
    const { missingOriginal, failed, ...counts } = report;
    console.table(counts);
    for (const url of missingOriginal) consoleLogger.warn({ url }, "Original não encontrada");
    if (failed.length > 0) process.exitCode = 1;
  } finally {
    await db.close();
  }
}

if (isCliEntry(import.meta.url, "images/backfill-image-variants")) runCli(main);

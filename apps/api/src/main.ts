import { setTimeout as sleep } from "node:timers/promises";
import closeWithGrace from "close-with-grace";
import { buildApp, httpConfigFrom } from "./app";
import { loadEnv } from "./config/env";
import { createContainer, DeferredLogger } from "./container";
import { findMigrationsDir, runMigrations } from "./shared/infra/database/migrate";
import { runSeed } from "./shared/infra/database/seed";
import { JobScheduler } from "./shared/infra/jobs/scheduler";

const VERSION = process.env.npm_package_version ?? "0.1.0";

async function main(): Promise<void> {
  const env = loadEnv();
  const logger = new DeferredLogger();
  const container = await createContainer({ env, version: VERSION, logger });
  let draining = false;
  const app = await buildApp(
    { ...httpConfigFrom(env, VERSION), isDraining: () => draining },
    container,
  );
  logger.use(app.log);

  const { db, hasher } = container.core;
  if (env.RUN_MIGRATIONS_ON_START) {
    await runMigrations(db, findMigrationsDir(env.MIGRATIONS_DIR), { logger });
  }
  if (env.SEED_ON_START && env.SEED_ADMIN_PASSWORD) {
    await runSeed(
      { db, hashPassword: (plain) => hasher.hash(plain), logger },
      { adminPassword: env.SEED_ADMIN_PASSWORD },
    );
  }

  const scheduler = new JobScheduler(db, logger);
  for (const job of container.jobs) scheduler.register(job);
  if (env.JOBS_ENABLED) scheduler.start();
  await container.start();

  // Ordem do encerramento (SIGTERM do orquestrador):
  // 1. readiness vira 503 e espera SHUTDOWN_DRAIN_MS (o balanceador tira a réplica);
  // 2. app.close(): para de aceitar conexões, responde 503 a quem chegar e
  //    espera as requisições em andamento; keep-alive ocioso é fechado;
  // 3. jobs terminam a rodada atual; 4. métricas pendentes gravadas e pool fechado.
  // Passou de SHUTDOWN_TIMEOUT_MS, o processo sai à força.
  closeWithGrace({ delay: env.SHUTDOWN_TIMEOUT_MS, logger: app.log }, async ({ signal, err }) => {
    if (err) app.log.error({ err }, "Encerrando por erro");
    else app.log.info({ signal, drainMs: env.SHUTDOWN_DRAIN_MS }, "Encerrando");
    draining = true;
    if (env.SHUTDOWN_DRAIN_MS > 0 && !err) await sleep(env.SHUTDOWN_DRAIN_MS);
    await app.close();
    await scheduler.stop();
    await container.close();
    app.log.info({}, "Encerrado");
  });

  await app.listen({ host: env.HOST, port: env.PORT });
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? (err.stack ?? err.message) : err);
  process.exit(1);
});

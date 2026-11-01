import type { Database, DatabaseLogger } from "../database/database";
import { sql } from "../database/sql";

export interface Job {
  /** Nome estável: vira a chave da trava distribuída. */
  name: string;
  intervalMs: number;
  run(): Promise<void>;
}

/** Espaço das travas de job (primeiro int do pg_try_advisory_lock(int, int)). */
const JOB_LOCK_NAMESPACE = 7310;

/**
 * Agendador em processo. Cada execução pega pg_try_advisory_lock(ns, hash(nome))
 * numa conexão fixa: com várias réplicas só uma executa o job naquela rodada,
 * as demais pulam. Execuções do mesmo job nunca se sobrepõem.
 */
export class JobScheduler {
  private readonly jobs: Job[] = [];
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private readonly running = new Set<Promise<void>>();
  private stopped = true;

  constructor(
    private readonly db: Database,
    private readonly logger: DatabaseLogger,
  ) {}

  register(job: Job): this {
    this.jobs.push(job);
    return this;
  }

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    for (const job of this.jobs) this.schedule(job, Math.min(5_000, job.intervalMs));
    this.logger.info({ jobs: this.jobs.map((j) => j.name) }, "Jobs agendados");
  }

  /** Para de agendar e espera as execuções em andamento terminarem. */
  async stop(): Promise<void> {
    this.stopped = true;
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    await Promise.allSettled([...this.running]);
  }

  /** Executa um job agora (com a trava). true se esta instância executou. */
  async runOnce(job: Job): Promise<boolean> {
    return this.db.withConnection(async () => {
      const { locked } = await this.db.one<{ locked: boolean }>(
        sql`select pg_try_advisory_lock(${JOB_LOCK_NAMESPACE}::int, hashtext(${job.name})) as locked`,
      );
      if (!locked) return false;
      try {
        await job.run();
        return true;
      } finally {
        await this.db.query(
          sql`select pg_advisory_unlock(${JOB_LOCK_NAMESPACE}::int, hashtext(${job.name}))`,
        );
      }
    });
  }

  private schedule(job: Job, delayMs: number): void {
    if (this.stopped) return;
    const timer = setTimeout(() => {
      const execution = this.execute(job).finally(() => {
        this.running.delete(execution);
        this.schedule(job, job.intervalMs);
      });
      this.running.add(execution);
    }, delayMs);
    // Timer de job não segura o processo vivo sozinho.
    timer.unref();
    this.timers.set(job.name, timer);
  }

  private async execute(job: Job): Promise<void> {
    const started = performance.now();
    try {
      const ran = await this.runOnce(job);
      if (ran) {
        const ms = Math.round(performance.now() - started);
        if (ms > 1_000) this.logger.warn({ job: job.name, ms }, "Job demorado");
      }
    } catch (err) {
      this.logger.error({ err, job: job.name }, "Falha no job");
    }
  }
}

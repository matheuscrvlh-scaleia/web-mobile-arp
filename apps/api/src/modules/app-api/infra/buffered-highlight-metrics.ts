import { toLocal } from "../../../shared/domain/time";
import type { Database, DatabaseLogger } from "../../../shared/infra/database/database";
import { sql } from "../../../shared/infra/database/sql";
import type { HighlightInteraction, HighlightMetricsRecorder } from "../domain/repositories";

interface Counts {
  highlightId: string;
  day: string;
  impressions: number;
  clicks: number;
}

/** Acima disso de chaves pendentes, grava sem esperar o intervalo. */
const EAGER_FLUSH_KEYS = 1_000;
/** Teto de chaves retidas após falhas seguidas de gravação (protege a memória). */
const MAX_PENDING_KEYS = 50_000;

/**
 * Acumula exibições/cliques em memória e grava em lote: um upsert por
 * destaque/dia a cada `intervalMs`, por réplica — em vez de um UPDATE por
 * exibição. Perde no máximo o último intervalo se o processo morrer sem
 * encerrar (o graceful shutdown chama flush()). Falha de gravação devolve
 * as contagens ao buffer para a próxima rodada.
 */
export class BufferedHighlightMetrics implements HighlightMetricsRecorder {
  private pending = new Map<string, Counts>();
  private timer: NodeJS.Timeout | null = null;
  private flushing: Promise<void> | null = null;

  constructor(
    private readonly db: Database,
    private readonly options: { intervalMs: number; logger?: DatabaseLogger },
  ) {}

  record(highlightId: string, interaction: HighlightInteraction, at: Date): void {
    const day = toLocal(at).date;
    const key = `${highlightId}|${day}`;
    let counts = this.pending.get(key);
    if (!counts) {
      counts = { highlightId, day, impressions: 0, clicks: 0 };
      this.pending.set(key, counts);
    }
    if (interaction === "click") counts.clicks++;
    else counts.impressions++;
    if (this.pending.size >= EAGER_FLUSH_KEYS) void this.flush();
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.flush(), this.options.intervalMs);
    this.timer.unref();
  }

  /** Para o timer e grava o que restou (encerramento). */
  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    // Uma gravação em andamento pode ter deixado contagens novas para trás.
    for (let i = 0; i < 3 && (this.flushing || this.pending.size > 0); i++) await this.flush();
  }

  /** Grava o acumulado. Chamadas simultâneas esperam a mesma gravação. */
  flush(): Promise<void> {
    if (this.flushing) return this.flushing;
    if (this.pending.size === 0) return Promise.resolve();
    const batch = [...this.pending.values()];
    this.pending = new Map();
    this.flushing = this.write(batch)
      .catch((err: unknown) => {
        this.options.logger?.warn(
          { err, keys: batch.length },
          "Falha ao gravar métricas de destaque; nova tentativa no próximo ciclo",
        );
        this.requeue(batch);
      })
      .finally(() => {
        this.flushing = null;
      });
    return this.flushing;
  }

  private async write(batch: Counts[]): Promise<void> {
    // Um statement só; o join descarta destaque apagado no meio do caminho (sem violar a FK).
    await this.db.query(sql`
      insert into marketing.highlight_daily_metrics as m (highlight_id, day, impressions, clicks)
      select u.highlight_id, u.day, u.impressions, u.clicks
      from unnest(${batch.map((b) => b.highlightId)}::uuid[], ${batch.map((b) => b.day)}::date[],
                  ${batch.map((b) => b.impressions)}::bigint[], ${batch.map((b) => b.clicks)}::bigint[])
             as u(highlight_id, day, impressions, clicks)
      join marketing.highlights h on h.id = u.highlight_id
      order by u.highlight_id, u.day
      on conflict (highlight_id, day) do update
        set impressions = m.impressions + excluded.impressions,
            clicks = m.clicks + excluded.clicks,
            updated_at = now()
    `);
  }

  private requeue(batch: Counts[]): void {
    for (const counts of batch) {
      if (this.pending.size >= MAX_PENDING_KEYS) return;
      const key = `${counts.highlightId}|${counts.day}`;
      const current = this.pending.get(key);
      if (current) {
        current.impressions += counts.impressions;
        current.clicks += counts.clicks;
      } else {
        this.pending.set(key, { ...counts });
      }
    }
  }
}

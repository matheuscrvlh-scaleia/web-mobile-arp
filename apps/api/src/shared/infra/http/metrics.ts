import { monitorEventLoopDelay } from "node:perf_hooks";
import type { FastifyInstance } from "fastify";
import type { PoolStats } from "../database/database";

/*
 * Métricas no formato texto do Prometheus, sem dependência: contador e
 * histograma de requisições por rota, pool do Postgres, cache e event loop.
 * Opcional (METRICS_ENABLED); a rota fica fora do prefixo da API.
 */

const BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

interface Histogram {
  counts: number[];
  sum: number;
  count: number;
}

export interface MetricsSources {
  pool(): PoolStats;
  cache?(): { entries: number; hits: number; misses: number; invalidations: number };
}

export class HttpMetrics {
  private readonly requests = new Map<string, number>();
  private readonly durations = new Map<string, Histogram>();
  private readonly loopDelay = monitorEventLoopDelay({ resolution: 20 });

  constructor(private readonly sources: MetricsSources) {
    this.loopDelay.enable();
  }

  observe(method: string, route: string, status: number, seconds: number): void {
    const key = `method="${method}",route="${route}",status="${status}"`;
    this.requests.set(key, (this.requests.get(key) ?? 0) + 1);
    const hKey = `method="${method}",route="${route}"`;
    let h = this.durations.get(hKey);
    if (!h) {
      h = { counts: BUCKETS.map(() => 0), sum: 0, count: 0 };
      this.durations.set(hKey, h);
    }
    for (let i = 0; i < BUCKETS.length; i++) {
      if (seconds <= (BUCKETS[i] as number)) h.counts[i] = (h.counts[i] ?? 0) + 1;
    }
    h.sum += seconds;
    h.count++;
  }

  render(): string {
    const lines: string[] = [];
    const gauge = (name: string, help: string, value: number) => {
      lines.push(`# HELP ${name} ${help}`, `# TYPE ${name} gauge`, `${name} ${value}`);
    };

    lines.push("# HELP http_requests_total Requisições por rota e status");
    lines.push("# TYPE http_requests_total counter");
    for (const [labels, value] of this.requests)
      lines.push(`http_requests_total{${labels}} ${value}`);

    lines.push("# HELP http_request_duration_seconds Tempo de resposta");
    lines.push("# TYPE http_request_duration_seconds histogram");
    for (const [labels, h] of this.durations) {
      BUCKETS.forEach((le, i) => {
        lines.push(`http_request_duration_seconds_bucket{${labels},le="${le}"} ${h.counts[i]}`);
      });
      lines.push(`http_request_duration_seconds_bucket{${labels},le="+Inf"} ${h.count}`);
      lines.push(`http_request_duration_seconds_sum{${labels}} ${h.sum}`);
      lines.push(`http_request_duration_seconds_count{${labels}} ${h.count}`);
    }

    const pool = this.sources.pool();
    gauge("db_pool_max", "Conexões máximas do pool", pool.max);
    gauge("db_pool_total", "Conexões abertas", pool.total);
    gauge("db_pool_idle", "Conexões ociosas", pool.idle);
    gauge("db_pool_waiting", "Pedidos esperando conexão (saturação)", pool.waiting);

    const cache = this.sources.cache?.();
    if (cache) {
      gauge("cache_entries", "Chaves no cache em memória", cache.entries);
      gauge("cache_hits_total", "Acertos do cache", cache.hits);
      gauge("cache_misses_total", "Faltas do cache", cache.misses);
      gauge("cache_invalidations_total", "Invalidações", cache.invalidations);
    }

    gauge(
      "nodejs_eventloop_delay_p99_seconds",
      "Atraso do event loop (p99)",
      this.loopDelay.percentile(99) / 1e9,
    );
    const memory = process.memoryUsage();
    gauge("process_resident_memory_bytes", "Memória residente", memory.rss);
    gauge("nodejs_heap_used_bytes", "Heap usado", memory.heapUsed);
    return `${lines.join("\n")}\n`;
  }

  close(): void {
    this.loopDelay.disable();
  }
}

/** Registra a coleta (onResponse) e GET /metrics. */
export function registerMetrics(
  app: FastifyInstance,
  metrics: HttpMetrics,
  options: { token?: string },
): void {
  app.addHook("onResponse", async (request, reply) => {
    const route = request.routeOptions.url ?? "desconhecida";
    if (route === "/metrics") return;
    metrics.observe(request.method, route, reply.statusCode, reply.elapsedTime / 1000);
  });
  app.get(
    "/metrics",
    { schema: { hide: true }, config: { rateLimit: false } },
    async (request, reply) => {
      if (options.token && request.headers.authorization !== `Bearer ${options.token}`) {
        return reply.code(401).send("unauthorized\n");
      }
      return reply.type("text/plain; version=0.0.4").send(metrics.render());
    },
  );
  app.addHook("onClose", async () => metrics.close());
}

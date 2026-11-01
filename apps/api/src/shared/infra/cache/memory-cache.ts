import type { Cache } from "../../application/ports/cache";

interface Entry {
  value: unknown;
  expiresAt: number;
}

export interface CacheStats {
  entries: number;
  hits: number;
  misses: number;
  invalidations: number;
}

/**
 * Cache em memória com TTL e teto de chaves (as mais antigas saem primeiro).
 * Carga concorrente da mesma chave é feita uma vez só (sem estouro de
 * consultas quando a chave expira sob carga). Erro na carga não é guardado.
 */
export class MemoryCache implements Cache {
  private readonly entries = new Map<string, Entry>();
  private readonly loading = new Map<string, Promise<unknown>>();
  /** Muda a cada invalidate: carga iniciada antes de uma invalidação não grava valor velho. */
  private generation = 0;
  private hits = 0;
  private misses = 0;
  private invalidations = 0;

  constructor(
    private readonly maxEntries = 1_000,
    private readonly now: () => number = Date.now,
  ) {}

  get<T>(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    if (ttlMs <= 0) return;
    this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: this.now() + ttlMs });
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }

  async getOrLoad<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== undefined) {
      this.hits++;
      return cached;
    }
    this.misses++;
    const pending = this.loading.get(key);
    if (pending) return pending as Promise<T>;

    const generation = this.generation;
    const promise: Promise<T> = load()
      .then((value) => {
        if (generation === this.generation) this.set(key, value, ttlMs);
        return value;
      })
      .finally(() => {
        if (this.loading.get(key) === promise) this.loading.delete(key);
      });
    this.loading.set(key, promise);
    return promise;
  }

  invalidate(prefix: string): void {
    this.invalidations++;
    this.generation++;
    for (const key of this.entries.keys()) {
      if (key.startsWith(prefix)) this.entries.delete(key);
    }
    // Cargas em andamento de chaves afetadas não são reaproveitadas por quem chegar agora.
    for (const key of this.loading.keys()) {
      if (key.startsWith(prefix)) this.loading.delete(key);
    }
  }

  stats(): CacheStats {
    return {
      entries: this.entries.size,
      hits: this.hits,
      misses: this.misses,
      invalidations: this.invalidations,
    };
  }
}

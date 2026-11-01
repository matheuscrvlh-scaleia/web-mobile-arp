/**
 * Cache curto (leituras compartilhadas do app, painéis caros). Em memória por
 * réplica; a invalidação pode ser propagada às outras réplicas pelo adaptador
 * (CACHE_INVALIDATION=postgres) sem tocar nos casos de uso.
 */
export interface Cache {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T, ttlMs: number): void;
  /** Lê do cache ou carrega, guardando por ttlMs. Chamadas simultâneas compartilham a carga. */
  getOrLoad<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T>;
  /** Remove as chaves que começam com o prefixo. */
  invalidate(prefix: string): void;
}

/** Prefixo das leituras públicas do app: toda escrita de conteúdo no painel o invalida. */
export const APP_CONTENT_CACHE_PREFIX = "app:";
/** Prefixo do "visitante ativo?" (checado a cada requisição autenticada do app). */
export const VISITOR_STATUS_CACHE_PREFIX = "visitor-active:";

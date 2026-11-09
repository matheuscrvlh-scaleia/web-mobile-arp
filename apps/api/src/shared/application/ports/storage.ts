/**
 * Porta de armazenamento de arquivos públicos (imagens de lojas, cupons,
 * eventos, destaques). Implementação: LocalDiskStorage (disco do servidor;
 * em produção, o volume da VPS). O banco guarda só a URL pública devolvida;
 * as miniaturas (`<uuid>_w<largura>.webp`) ficam ao lado da original, por
 * convenção (ver application/image-variants.ts).
 */
export interface Storage {
  /** Grava (sobrescreve se a chave existir) e devolve a URL pública. */
  put(
    key: string,
    body: Uint8Array,
    contentType: string,
    options?: PutOptions,
  ): Promise<StoredObject>;
  /** Apaga; não falha se a chave não existir. */
  remove(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  /** Conteúdo do arquivo; null se a chave não existir (backfill das miniaturas). */
  get(key: string): Promise<Uint8Array | null>;
  /** URL pública da chave (não verifica se existe). */
  publicUrl(key: string): string;
  /**
   * Chave a partir de uma URL gravada no banco, se a URL for deste storage.
   * Serve para apagar a imagem antiga ao trocar; URL externa → null.
   */
  keyFromUrl(url: string): string | null;
}

export interface PutOptions {
  /** Segundos de cache no CDN/navegador. Chave com uuid nunca muda: pode ser longo. */
  cacheControlSeconds?: number;
}

export interface StoredObject {
  key: string;
  url: string;
}

const KEY_PATTERN = /^[a-z0-9][a-z0-9._-]*(\/[a-z0-9][a-z0-9._-]*)*$/i;

/** Chave relativa, sem "..", sem barra inicial e só com caracteres seguros em URL. */
export function assertValidStorageKey(key: string): void {
  if (key.length > 512 || !KEY_PATTERN.test(key) || key.split("/").includes("..")) {
    throw new Error(`Chave de storage inválida: ${key}`);
  }
}

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function extensionForMime(mimeType: string): string {
  const ext = EXTENSION_BY_MIME[mimeType];
  if (!ext) throw new Error(`Tipo de arquivo não suportado: ${mimeType}`);
  return ext;
}

/**
 * Chave de um upload novo: <pasta>/<AAAA>/<MM>/<uuid>.<ext>. O uuid evita
 * colisão e permite cache longo; a data facilita limpeza por período.
 */
export function buildMediaKey(folder: string, mimeType: string, now: Date = new Date()): string {
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const key = `${folder}/${yyyy}/${mm}/${crypto.randomUUID()}.${extensionForMime(mimeType)}`;
  assertValidStorageKey(key);
  return key;
}

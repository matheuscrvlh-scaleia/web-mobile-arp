import { IMAGE_WIDTHS, type ImageWidth, imageVariantUrl } from "@arp/contracts";
import type { ImageProcessor, ImageReferences } from "./ports/images";
import type { Storage } from "./ports/storage";

/*
 * Miniaturas das imagens enviadas à API. Convenção (a mesma do helper
 * imageVariantUrl do contrato, usado pelo app e pelo painel):
 *   <pasta>/<AAAA>/<MM>/<uuid>.<ext> → <pasta>/<AAAA>/<MM>/<uuid>_w<largura>.webp
 * Só a URL da original vai para o banco.
 */

/** Cache das imagens: a chave tem uuid e nunca muda de conteúdo. */
export const IMAGE_CACHE_SECONDS = 31_536_000;
const WEBP = "image/webp";

export interface VariantKey {
  width: ImageWidth;
  key: string;
}

/** Chaves das miniaturas; vazio se a chave não segue <uuid>.<ext> (sem miniaturas). */
export function imageVariantKeys(key: string): VariantKey[] {
  return IMAGE_WIDTHS.map((width) => ({ width, key: imageVariantUrl(key, width) })).filter(
    (v) => v.key !== key,
  );
}

/** Original e miniaturas (para apagar tudo junto). */
export function imageKeysWithVariants(key: string): string[] {
  return [key, ...imageVariantKeys(key).map((v) => v.key)];
}

export interface RenderedVariant {
  key: string;
  body: Uint8Array;
}

export type EnsureResult =
  | { status: "complete" | "not-applicable" | "missing-original" }
  | { status: "created"; created: number };

/** Gera e grava miniaturas no storage. */
export class ImageVariants {
  constructor(private readonly deps: { storage: Storage; processor: ImageProcessor }) {}

  /** Gera as miniaturas em memória (antes de gravar a original, para recusar imagem ilegível). */
  async generate(key: string, bytes: Uint8Array): Promise<RenderedVariant[]> {
    const keys = imageVariantKeys(key);
    return keys.length === 0 ? [] : this.render(keys, bytes);
  }

  async put(variants: readonly RenderedVariant[]): Promise<void> {
    await Promise.all(
      variants.map((v) =>
        this.deps.storage.put(v.key, v.body, WEBP, { cacheControlSeconds: IMAGE_CACHE_SECONDS }),
      ),
    );
  }

  /**
   * Gera só as miniaturas que faltam (seed e backfill; idempotente).
   * `original` lê os bytes da original só se precisar.
   */
  async ensure(key: string, original: () => Promise<Uint8Array | null>): Promise<EnsureResult> {
    if (imageVariantKeys(key).length === 0) return { status: "not-applicable" };
    const missing = await this.missing(key);
    if (missing.length === 0) return { status: "complete" };
    const bytes = await original();
    if (!bytes) return { status: "missing-original" };
    await this.put(await this.render(missing, bytes));
    return { status: "created", created: missing.length };
  }

  /** Miniaturas que ainda não existem no storage. */
  async missing(key: string): Promise<VariantKey[]> {
    const keys = imageVariantKeys(key);
    const present = await Promise.all(keys.map((k) => this.deps.storage.exists(k.key)));
    return keys.filter((_, i) => !present[i]);
  }

  private async render(keys: readonly VariantKey[], bytes: Uint8Array): Promise<RenderedVariant[]> {
    const variants = await this.deps.processor.webpVariants(
      bytes,
      keys.map((k) => k.width),
    );
    return keys.map(({ width, key }) => {
      const variant = variants.find((v) => v.width === width);
      if (!variant) throw new Error(`Miniatura de ${width}px não gerada (${key})`);
      return { key, body: variant.body };
    });
  }
}

/** Porta dos casos de uso: apaga imagens que deixaram de ser usadas. */
export interface ImageCleanup {
  discard(urls: readonly (string | null | undefined)[]): Promise<void>;
}

/** URLs de `fields` que existiam em `before` e não estão mais em `after` (troca de imagem). */
export function replacedImageUrls<T>(before: T, after: T, fields: readonly (keyof T)[]): string[] {
  const kept = new Set(fields.map((f) => after[f]));
  return fields
    .map((f) => before[f])
    .filter((url): url is T[keyof T] & string => typeof url === "string" && !kept.has(url));
}

/**
 * Apaga original + miniaturas das URLs deste storage que nenhuma linha do
 * banco usa mais. Chamar DEPOIS do commit. Melhor esforço: falha vira log
 * (arquivo órfão é inofensivo; erro aqui não pode desfazer a edição).
 */
export class StorageImageCleanup implements ImageCleanup {
  constructor(
    private readonly deps: {
      storage: Storage;
      references: ImageReferences;
      onError?: (err: unknown, url: string) => void;
    },
  ) {}

  async discard(urls: readonly (string | null | undefined)[]): Promise<void> {
    const { storage, references, onError } = this.deps;
    const unique = [...new Set(urls.filter((u): u is string => !!u))];
    await Promise.all(
      unique.map(async (url) => {
        const key = storage.keyFromUrl(url);
        if (!key) return; // URL externa: não é nossa
        try {
          // A mesma URL pode estar em outra linha (ex.: destaque usando a foto do evento).
          if (await references.isReferenced(url)) return;
          await Promise.all(imageKeysWithVariants(key).map((k) => storage.remove(k)));
        } catch (err) {
          onError?.(err, url);
        }
      }),
    );
  }
}

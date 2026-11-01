/**
 * Miniaturas das imagens (logos, capas, cupons, eventos, destaques).
 *
 * Toda imagem enviada pelo upload (`POST /uploads`) ou pelo seed tem, ao lado
 * da original, uma variante WebP para cada largura de `IMAGE_WIDTHS`: largura
 * máxima (nunca amplia imagem menor), já orientada e sem metadados, com o mesmo
 * cache longo da original. O banco guarda só a URL da original; a URL da
 * variante sai por convenção:
 *
 *   …/<pasta>/<AAAA>/<MM>/<uuid>.<ext>  →  …/<pasta>/<AAAA>/<MM>/<uuid>_w480.webp
 */

/** 160: logo/avatar em lista · 480: cards · 960: tela de detalhe. */
export const IMAGE_WIDTHS = [160, 480, 960] as const;
export type ImageWidth = (typeof IMAGE_WIDTHS)[number];

// Nome gerado pela API: <uuid>.<ext> no fim do caminho (antes de ?query/#hash).
const UPLOAD_NAME =
  /(^|\/)([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(jpe?g|png|webp)$/i;

function splitSuffix(url: string): [path: string, suffix: string] {
  const cut = url.search(/[?#]/);
  return cut === -1 ? [url, ""] : [url.slice(0, cut), url.slice(cut)];
}

/** true se a URL (ou chave do storage) é de imagem enviada à API, que tem variantes. */
export function hasImageVariants(url: string): boolean {
  return UPLOAD_NAME.test(splitSuffix(url)[0]);
}

/**
 * URL da miniatura WebP com a largura pedida.
 *
 * - URL de upload da API (pública do Supabase Storage ou `/uploads/...` local,
 *   reconhecida pelo `<uuid>.<ext>` no fim do caminho) → URL da variante, ex.:
 *   `https://x.supabase.co/storage/v1/object/public/media/stores/2026/11/<uuid>.jpg`
 *   → `…/stores/2026/11/<uuid>_w480.webp`. Query string e hash são mantidos.
 * - Qualquer outra URL (externa, de terceiros, sem uuid) → a própria URL.
 * - `null`/`undefined` → `null`.
 *
 * Função pura, sem rede: não confere se o arquivo existe. A API garante as
 * variantes de tudo que passa pelo upload e pelo seed (e o backfill
 * `images:thumbnails` cobre imagens antigas).
 */
export function imageVariantUrl(url: string, width: ImageWidth): string;
export function imageVariantUrl(url: string | null | undefined, width: ImageWidth): string | null;
export function imageVariantUrl(url: string | null | undefined, width: ImageWidth): string | null {
  if (!url) return null;
  // Largura fora da lista (chamada sem tipo, ex.: JS) não tem arquivo: devolve a original.
  if (!(IMAGE_WIDTHS as readonly number[]).includes(width)) return url;
  const [path, suffix] = splitSuffix(url);
  if (!UPLOAD_NAME.test(path)) return url;
  return `${path.replace(UPLOAD_NAME, `$1$2_w${width}.webp`)}${suffix}`;
}

/**
 * Menor largura que cobre `displayWidth` pontos na tela com a densidade dada
 * (ex.: 120 pt × 3 = 360 px → 480). Acima da maior, devolve a maior.
 */
export function imageWidthFor(displayWidth: number, pixelRatio = 1): ImageWidth {
  const pixels = displayWidth * pixelRatio;
  return IMAGE_WIDTHS.find((w) => w >= pixels) ?? (IMAGE_WIDTHS.at(-1) as ImageWidth);
}

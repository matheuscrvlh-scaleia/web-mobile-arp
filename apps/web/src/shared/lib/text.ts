/** Minúsculas e sem acento, para busca local ("Café" casa com "cafe"). */
export function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** "Casa Brava" → "casa-brava" (mesma regra do slugSchema do contrato). */
export function slugify(text: string): string {
  return normalize(text)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Campo de texto opcional: vazio vira null (o contrato usa null para "sem valor"). */
export function emptyToNull(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const t = value.trim();
  return t === "" ? null : t;
}

/** Só volta para caminhos internos do painel (nunca para outro site). */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next) return null;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  if (next.startsWith("/login")) return null;
  return next;
}

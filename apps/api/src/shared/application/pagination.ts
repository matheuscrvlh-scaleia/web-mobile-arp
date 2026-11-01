/** Página pedida (já validada pelo contrato: page ≥ 1, 1 ≤ pageSize ≤ 100). */
export interface PageRequest {
  page: number;
  pageSize: number;
}

export interface Page<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export function offsetOf({ page, pageSize }: PageRequest): number {
  return (page - 1) * pageSize;
}

/**
 * Página a partir de linhas com `total` (count(*) over() na mesma consulta),
 * para listas pequenas. Página além do fim vem vazia e com total 0.
 */
export function toPage<R extends { total: number }, T>(
  rows: readonly R[],
  request: PageRequest,
  map: (row: R) => T,
): Page<T> {
  return toCountedPage(rows, request, rows[0]?.total ?? 0, map);
}

/**
 * Página com a contagem feita à parte (listas que crescem: a página sai pelo
 * índice e o count é uma consulta enxuta, sem materializar a tabela).
 */
export function toCountedPage<R, T>(
  rows: readonly R[],
  request: PageRequest,
  total: number,
  map: (row: R) => T,
): Page<T> {
  return {
    data: rows.map(map),
    meta: {
      page: request.page,
      pageSize: request.pageSize,
      total,
      totalPages: Math.ceil(total / request.pageSize),
    },
  };
}

/* Keyset (cursor) --------------------------------------------------------- */

/** Página por cursor: sem total (-1), com o cursor da próxima. */
export interface KeysetPage<T> extends Page<T> {
  meta: Page<T>["meta"] & { nextCursor: string | null };
}

/**
 * Cursor opaco = posição da última linha na ordenação (ex.: [criadoEm, id]).
 * Base64url de JSON: o cliente só devolve o que recebeu.
 */
export function encodeCursor(position: readonly string[]): string {
  return Buffer.from(JSON.stringify(position), "utf8").toString("base64url");
}

/** null se o cursor não for um que a API emitiu (com `size` posições de texto). */
export function decodeCursor(cursor: string, size: number): string[] | null {
  try {
    const value: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (
      Array.isArray(value) &&
      value.length === size &&
      value.every((v) => typeof v === "string" && v.length > 0 && v.length <= 64)
    ) {
      return value as string[];
    }
  } catch {
    // cai no null
  }
  return null;
}

/**
 * Monta a página a partir de `pageSize + 1` linhas (a extra só diz que há
 * mais). `total` null = modo cursor (sem contagem, meta.total = -1).
 */
export function toKeysetPage<R, T>(
  rows: readonly R[],
  request: PageRequest,
  total: number | null,
  position: (row: R) => readonly string[],
  map: (row: R) => T,
): KeysetPage<T> {
  const hasMore = rows.length > request.pageSize;
  const visible = hasMore ? rows.slice(0, request.pageSize) : rows;
  const last = visible.at(-1);
  return {
    data: visible.map(map),
    meta: {
      page: request.page,
      pageSize: request.pageSize,
      total: total ?? -1,
      totalPages: total === null ? -1 : Math.ceil(total / request.pageSize),
      nextCursor: hasMore && last !== undefined ? encodeCursor(position(last)) : null,
    },
  };
}

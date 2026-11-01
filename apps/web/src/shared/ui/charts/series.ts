/**
 * Cores das séries por categoria (globals.css, --serie-1..5), na ordem
 * validada para daltonismo. Presas à categoria, nunca à posição: a mesma
 * métrica tem sempre a mesma cor em todas as telas.
 */
export type SeriesColor = 1 | 2 | 3 | 4 | 5 | "neutral";

export const seriesColor = (c: SeriesColor) =>
  c === "neutral" ? "var(--serie-neutro)" : `var(--serie-${c})`;

export interface SeriesDef<K extends string = string> {
  key: K;
  label: string;
  color: SeriesColor;
}

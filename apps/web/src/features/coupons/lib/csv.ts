// Exportar CSV no navegador (relatórios e cupons pegos), pronto para o Excel
// em português: separador ";", BOM UTF-8 (acentos) e números com vírgula.

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

function cell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const text = typeof v === "number" ? String(v).replace(".", ",") : v;
  // Fórmula no Excel (=, +, -, @) vira texto: evita injeção de fórmula.
  const safe = /^[=+\-@]/.test(text) && typeof v === "string" ? `'${text}` : text;
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  const lines = [columns.map((c) => cell(c.header)).join(";")];
  for (const row of rows) lines.push(columns.map((c) => cell(c.value(row))).join(";"));
  return lines.join("\r\n");
}

/** Baixa o CSV com o nome dado (ex.: "cupons-pegos-2026-11-06.csv"). */
export function downloadCsv<T>(
  filename: string,
  rows: readonly T[],
  columns: readonly CsvColumn<T>[],
): void {
  const blob = new Blob([`﻿${toCsv(rows, columns)}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

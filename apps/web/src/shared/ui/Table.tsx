import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

export interface Column<T> {
  /** Identidade da coluna (também a key do React). */
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** Números alinham à direita, com algarismos tabulares. */
  numeric?: boolean;
  /** Classe do cabeçalho e das células (ex.: "hidden lg:table-cell"). */
  className?: string;
}

/**
 * Tabela com rolagem lateral dentro do quadro (nunca a página). Com
 * `maxHeight`, rola também na vertical com o cabeçalho preso. Carregando,
 * mostra linhas-esqueleto no lugar; vazia, o `empty`.
 */
export function Table<T>({
  columns,
  rows,
  rowKey,
  caption,
  loading = false,
  skeletonRows = 6,
  empty,
  maxHeight,
  rowClassName,
  className,
}: {
  columns: Column<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => string;
  /** Descrição da tabela para leitores de tela. */
  caption: string;
  loading?: boolean;
  skeletonRows?: number;
  empty?: ReactNode;
  /** Ex.: "max-h-[28rem]": rola por dentro com o cabeçalho fixo. */
  maxHeight?: string;
  rowClassName?: (row: T) => string | undefined;
  className?: string;
}) {
  const align = (c: Column<T>) =>
    cn(c.numeric ? "text-right tabular-nums" : "text-left", c.className);
  const showEmpty = !loading && rows !== undefined && rows.length === 0;
  return (
    <div
      className={cn("-mx-2 overflow-x-auto", maxHeight && "overflow-y-auto", maxHeight, className)}
    >
      <table className="w-full min-w-max border-collapse text-sm" aria-busy={loading || undefined}>
        <caption className="sr-only">{caption}</caption>
        <thead className={cn(maxHeight && "sticky top-0 z-10 bg-white/85 backdrop-blur")}>
          <tr className="border-b border-neutral-200 text-xs text-neutral-500">
            {columns.map((c) => (
              <th key={c.key} scope="col" className={cn("px-2 py-2.5 font-medium", align(c))}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: skeletonRows }, (_, i) => (
                <tr
                  // biome-ignore lint/suspicious/noArrayIndexKey: linhas-esqueleto fixas
                  key={i}
                  aria-hidden
                  className="border-b border-neutral-900/[0.06] last:border-0"
                >
                  {columns.map((c) => (
                    <td key={c.key} className={cn("px-2 py-3", c.className)}>
                      <span className="carregando block h-4 w-full max-w-40 rounded-full" />
                    </td>
                  ))}
                </tr>
              ))
            : rows?.map((row) => (
                <tr
                  key={rowKey(row)}
                  className={cn(
                    "border-b border-neutral-900/[0.06] transition-colors last:border-0 hover:bg-white/50",
                    rowClassName?.(row),
                  )}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={cn("px-2 py-2.5 align-middle", align(c))}>
                      {c.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
      {showEmpty &&
        (empty ?? (
          <p className="px-2 py-8 text-center text-sm text-neutral-500">Nenhum registro.</p>
        ))}
    </div>
  );
}

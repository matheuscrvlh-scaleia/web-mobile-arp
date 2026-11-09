import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { KeyboardEvent, MouseEvent, ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { useIsMobile } from "@/shared/hooks";
import { cn } from "@/shared/lib/cn";

export interface Column<T> {
  /** Identidade da coluna (também a key do React e da ordenação). */
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** Números alinham à direita, com algarismos tabulares. */
  numeric?: boolean;
  /** Classe do cabeçalho e das células (ex.: "hidden lg:table-cell"). */
  className?: string;
  /** Mostra o botão de ordenar no cabeçalho (a ordenação em si é de quem chama). */
  sortable?: boolean;
  // Cartões (mobile="cards", abaixo de md):
  /** O título do cartão (nome do item). Com `rowHref`, vira o link da linha. */
  primary?: boolean;
  /** Selo de situação: vai no topo do cartão, sem rótulo. */
  status?: boolean;
  /** Ações ("⋯", switch): canto superior direito do cartão, sem rótulo. */
  actions?: boolean;
  /** Some no cartão. */
  hideOnMobile?: boolean;
  /** Rótulo no cartão quando o `header` não é texto. */
  mobileLabel?: string;
}

export type SortDirection = "asc" | "desc";
export interface TableSort {
  key: string;
  direction: SortDirection;
}

/** Cliques nestes elementos não abrem a linha (botões, links, campos, menus). */
const INTERACTIVE =
  "a,button,input,select,textarea,label,[role=menu],[role=menuitem],[data-no-row-click]";

function isInteractive(e: MouseEvent | KeyboardEvent): boolean {
  const target = e.target as HTMLElement;
  // Veio de um portal (modal, menu) aberto a partir da linha: não é clique na linha.
  if (!e.currentTarget.contains(target)) return true;
  const hit = target.closest(INTERACTIVE);
  return Boolean(hit && e.currentTarget.contains(hit) && hit !== e.currentTarget);
}

/**
 * Tabela com rolagem lateral dentro do quadro (nunca a página). Com
 * `maxHeight`, rola também na vertical com o cabeçalho preso. Carregando,
 * mostra linhas-esqueleto no lugar; vazia, o `empty`.
 *
 * - `rowHref`/`onRowClick`: a linha inteira abre o item (a coluna `primary`,
 *   ou a primeira, vira um link de verdade para teclado e leitor de tela).
 * - `mobile="cards"`: abaixo de md cada linha vira um cartão.
 * - `sort` + `onSortChange` + `sortable` na coluna: cabeçalho clicável com aria-sort.
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
  rowHref,
  onRowClick,
  rowLabel,
  mobile = "scroll",
  sort,
  onSortChange,
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
  /** Endereço do detalhe: a linha toda vira clicável (Ctrl/⌘+clique abre em outra aba). */
  rowHref?: (row: T) => string;
  /** Alternativa ao `rowHref` quando abrir não é navegar (ex.: abrir um modal). */
  onRowClick?: (row: T) => void;
  /** Nome acessível do link/botão da linha (padrão: o texto da célula principal). */
  rowLabel?: (row: T) => string;
  /** "cards": no celular, cartões no lugar da tabela. Padrão: rolar de lado. */
  mobile?: "scroll" | "cards";
  sort?: TableSort | null;
  onSortChange?: (sort: TableSort) => void;
}) {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const showEmpty = !loading && rows !== undefined && rows.length === 0;
  const clickable = Boolean(rowHref || onRowClick);
  const primaryKey = (columns.find((c) => c.primary) ?? columns[0])?.key;

  const open = (row: T, e: MouseEvent | KeyboardEvent) => {
    if (isInteractive(e)) return;
    if (window.getSelection()?.toString()) return; // estava selecionando texto
    if (rowHref) {
      const href = rowHref(row);
      if ("metaKey" in e && (e.metaKey || e.ctrlKey)) window.open(href, "_blank");
      else navigate(href);
    } else onRowClick?.(row);
  };

  /** Conteúdo da célula principal: link (rowHref) ou botão (onRowClick). */
  const primaryContent = (row: T, content: ReactNode) => {
    if (rowHref)
      return (
        <Link
          to={rowHref(row)}
          aria-label={rowLabel?.(row)}
          className="rounded-md outline-offset-4 hover:underline"
        >
          {content}
        </Link>
      );
    if (onRowClick)
      return (
        <button
          type="button"
          aria-label={rowLabel?.(row)}
          onClick={() => onRowClick(row)}
          className="cursor-pointer rounded-md text-left outline-offset-4 hover:underline"
        >
          {content}
        </button>
      );
    return content;
  };

  if (isMobile && mobile === "cards") {
    return (
      <div data-guia="tabela" className={className}>
        <ul aria-label={caption} aria-busy={loading || undefined} className="flex flex-col gap-2">
          {loading
            ? Array.from({ length: Math.min(skeletonRows, 4) }, (_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: cartões-esqueleto fixos
                <li key={i} aria-hidden className="rounded-2xl bg-white/60 p-4">
                  <span className="carregando block h-4 w-2/3 rounded-full" />
                  <span className="carregando mt-3 block h-3 w-1/3 rounded-full" />
                </li>
              ))
            : rows?.map((row) => (
                <RowCard
                  key={rowKey(row)}
                  row={row}
                  columns={columns}
                  primaryKey={primaryKey}
                  primaryContent={primaryContent}
                  onOpen={clickable ? (e) => open(row, e) : undefined}
                  className={rowClassName?.(row)}
                />
              ))}
        </ul>
        {showEmpty &&
          (empty ?? (
            <p className="px-2 py-8 text-center text-sm text-neutral-500">Nenhum registro.</p>
          ))}
      </div>
    );
  }

  const align = (c: Column<T>) =>
    cn(c.numeric ? "text-right tabular-nums" : "text-left", c.className);

  const header = (c: Column<T>) => {
    if (!c.sortable || !onSortChange) return c.header;
    const active = sort?.key === c.key;
    const Icon = !active ? ArrowUpDown : sort?.direction === "asc" ? ArrowUp : ArrowDown;
    return (
      <button
        type="button"
        onClick={() =>
          onSortChange({
            key: c.key,
            direction: active && sort?.direction === "asc" ? "desc" : "asc",
          })
        }
        className={cn(
          "-mx-1 inline-flex cursor-pointer items-center gap-1 rounded-md px-1 py-0.5 hover:text-neutral-900",
          active && "text-neutral-900",
        )}
      >
        {c.header}
        <Icon className={cn("size-3.5", !active && "opacity-50")} aria-hidden />
      </button>
    );
  };

  return (
    <div
      data-guia="tabela"
      className={cn("-mx-2 overflow-x-auto", maxHeight && "overflow-y-auto", maxHeight, className)}
    >
      <table className="w-full min-w-max border-collapse text-sm" aria-busy={loading || undefined}>
        <caption className="sr-only">{caption}</caption>
        <thead className={cn(maxHeight && "sticky top-0 z-10 bg-white/85 backdrop-blur")}>
          <tr className="border-b border-neutral-200 text-xs text-neutral-500">
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                aria-sort={
                  c.sortable && sort?.key === c.key
                    ? sort.direction === "asc"
                      ? "ascending"
                      : "descending"
                    : undefined
                }
                className={cn("px-2 py-2.5 font-medium", align(c))}
              >
                {header(c)}
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
                  onClick={clickable ? (e) => open(row, e) : undefined}
                  className={cn(
                    "border-b border-neutral-900/[0.06] transition-colors last:border-0 hover:bg-white/50",
                    clickable && "cursor-pointer focus-within:bg-white/50",
                    rowClassName?.(row),
                  )}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={cn("px-2 py-2.5 align-middle", align(c))}>
                      {clickable && c.key === primaryKey
                        ? primaryContent(row, c.cell(row))
                        : c.cell(row)}
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

/** Uma linha como cartão: título (primary) + ações no topo, situação, pares rótulo: valor. */
function RowCard<T>({
  row,
  columns,
  primaryKey,
  primaryContent,
  onOpen,
  className,
}: {
  row: T;
  columns: Column<T>[];
  primaryKey: string | undefined;
  primaryContent: (row: T, content: ReactNode) => ReactNode;
  onOpen?: (e: MouseEvent) => void;
  className?: string;
}) {
  const primary = columns.find((c) => c.key === primaryKey);
  const statuses = columns.filter((c) => c.status && !c.hideOnMobile);
  const actions = columns.filter((c) => c.actions && !c.hideOnMobile);
  const rest = columns.filter((c) => c !== primary && !c.status && !c.actions && !c.hideOnMobile);
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: o teclado usa o link/botão do título
    <li
      onClick={onOpen}
      className={cn(
        "rounded-2xl border border-neutral-900/[0.06] bg-white/70 p-4 text-sm",
        onOpen && "cursor-pointer transition-colors hover:bg-white focus-within:bg-white",
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 font-medium text-neutral-900">
          {primary && (onOpen ? primaryContent(row, primary.cell(row)) : primary.cell(row))}
        </div>
        {actions.length > 0 && (
          <div className="-mt-1.5 -mr-1.5 flex shrink-0 items-center gap-1">
            {actions.map((c) => (
              <span key={c.key}>{c.cell(row)}</span>
            ))}
          </div>
        )}
      </div>
      {statuses.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {statuses.map((c) => (
            <span key={c.key}>{c.cell(row)}</span>
          ))}
        </div>
      )}
      {rest.length > 0 && (
        <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5">
          {rest.map((c) => (
            <div key={c.key} className="contents">
              <dt className="text-xs text-neutral-500">
                {c.mobileLabel ?? (typeof c.header === "string" ? c.header : c.key)}
              </dt>
              <dd className="min-w-0 text-right text-neutral-800 tabular-nums">{c.cell(row)}</dd>
            </div>
          ))}
        </dl>
      )}
    </li>
  );
}

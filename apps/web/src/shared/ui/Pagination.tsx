import type { PageMeta } from "@arp/contracts";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { formatNumber } from "@/shared/lib/format";

/** Páginas visíveis: primeira, última e vizinhas da atual, com "…" no meio. */
export function pageWindow(page: number, total: number): (number | "gap")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, total, page - 1, page, page + 1]);
  const pages = [...set].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  pages.forEach((p, i) => {
    const prev = pages[i - 1];
    if (prev !== undefined && p - prev > 1) out.push("gap");
    out.push(p);
  });
  return out;
}

const BTN =
  "inline-grid h-9 min-w-9 cursor-pointer place-items-center rounded-full px-2 text-sm tabular-nums transition disabled:cursor-not-allowed disabled:opacity-40";

export function Pagination({
  meta,
  onPageChange,
  className,
}: {
  meta: PageMeta;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  const { page, pageSize, total, totalPages } = meta;
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3 pt-4", className)}>
      <p className="text-xs text-neutral-500">
        {formatNumber(from)}–{formatNumber(to)} de {formatNumber(total)}
      </p>
      {totalPages > 1 && (
        <nav aria-label="Paginação" className="flex items-center gap-1">
          <button
            type="button"
            className={cn(BTN, "text-neutral-600 hover:bg-neutral-900/[0.06]")}
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            aria-label="Página anterior"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          {pageWindow(page, totalPages).map((p, i) =>
            p === "gap" ? (
              // biome-ignore lint/suspicious/noArrayIndexKey: separador sem identidade própria
              <span key={`gap-${i}`} aria-hidden className="px-1 text-neutral-400">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                aria-current={p === page ? "page" : undefined}
                aria-label={`Página ${p}`}
                className={cn(
                  BTN,
                  p === page
                    ? "bg-neutral-900 font-medium text-white"
                    : "text-neutral-600 hover:bg-neutral-900/[0.06]",
                )}
              >
                {p}
              </button>
            ),
          )}
          <button
            type="button"
            className={cn(BTN, "text-neutral-600 hover:bg-neutral-900/[0.06]")}
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            aria-label="Próxima página"
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </nav>
      )}
    </div>
  );
}

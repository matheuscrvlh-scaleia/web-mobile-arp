import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { cn } from "@/shared/lib/cn";
import { formatPercent } from "@/shared/lib/format";
import { type SeriesColor, seriesColor } from "./series";

export interface BarListItem {
  key: string;
  label: ReactNode;
  value: number;
  /** Valor já formatado (à direita). */
  valueText: string;
  /** Linha pequena abaixo do rótulo. */
  sublabel?: ReactNode;
  /** Algo antes do rótulo (ícone da loja, selo). */
  leading?: ReactNode;
  href?: string;
}

/**
 * Ranking em barras horizontais (top lojas, top cupons). A barra é a
 * proporção do maior valor; o número exato fica sempre escrito ao lado.
 */
export function BarList({
  items,
  label,
  emptyText = "Nada no período.",
}: {
  items: BarListItem[];
  /** O que a lista mostra, para leitores de tela. */
  label: string;
  emptyText?: string;
}) {
  if (items.length === 0) {
    return <p className="py-8 text-center text-sm text-neutral-500">{emptyText}</p>;
  }
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <ol aria-label={label} className="flex flex-col gap-1">
      {items.map((item, idx) => {
        const body = (
          <>
            <span className="w-5 shrink-0 text-xs text-neutral-400 tabular-nums">{idx + 1}</span>
            {item.leading}
            <span className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-sm font-medium text-neutral-900">
                  {item.label}
                </span>
                <span className="shrink-0 text-sm font-semibold tabular-nums">
                  {item.valueText}
                </span>
              </span>
              <span
                aria-hidden
                className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-900/[0.06]"
              >
                <span
                  className="block h-full rounded-full bg-neutral-900/80"
                  style={{ width: `${Math.max((item.value / max) * 100, 2)}%` }}
                />
              </span>
              {item.sublabel && <span className="text-xs text-neutral-500">{item.sublabel}</span>}
            </span>
          </>
        );
        const row = "flex items-center gap-3 rounded-2xl px-2 py-2";
        return (
          <li key={item.key}>
            {item.href ? (
              <Link to={item.href} className={cn(row, "transition hover:bg-white/60")}>
                {body}
              </Link>
            ) : (
              <div className={row}>{body}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export interface ProportionSegment {
  key: string;
  label: string;
  value: number;
  color: SeriesColor;
  icon: LucideIcon;
  /** Explicação curta na legenda. */
  hint?: string;
}

/**
 * Partes de um todo numa barra só (ex.: resultado das leituras de QR), com
 * legenda de ícone + rótulo + número + %: a cor nunca carrega sozinha.
 */
export function ProportionBar({
  segments,
  label,
  formatValue,
}: {
  segments: ProportionSegment[];
  label: string;
  formatValue: (v: number) => string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (total === 0) {
    return <p className="py-8 text-center text-sm text-neutral-500">Nenhum registro no período.</p>;
  }
  return (
    <figure className="flex flex-col gap-4">
      <div aria-hidden className="flex h-4 w-full gap-0.5 overflow-hidden rounded-full">
        {segments
          .filter((s) => s.value > 0)
          .map((s) => (
            <span
              key={s.key}
              className="h-full first:rounded-l-full last:rounded-r-full"
              style={{
                width: `${(s.value / total) * 100}%`,
                backgroundColor: seriesColor(s.color),
              }}
              title={`${s.label}: ${formatValue(s.value)}`}
            />
          ))}
      </div>
      <ul aria-label={label} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {segments.map((s) => {
          const Icon = s.icon;
          return (
            <li
              key={s.key}
              className="flex items-start gap-2.5 rounded-2xl bg-neutral-900/[0.03] p-2.5"
            >
              <span
                className="grid size-7 shrink-0 place-items-center rounded-full text-[#fff]"
                style={{ backgroundColor: seriesColor(s.color) }}
              >
                <Icon className="size-3.5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-sm text-neutral-700">{s.label}</span>
                  <span className="text-sm font-semibold tabular-nums">{formatValue(s.value)}</span>
                </span>
                <span className="block text-xs text-neutral-500">
                  {formatPercent(s.value / total)}
                  {s.hint ? ` · ${s.hint}` : ""}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </figure>
  );
}

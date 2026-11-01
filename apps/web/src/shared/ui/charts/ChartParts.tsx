import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";
import { type SeriesColor, seriesColor } from "./series";

/** Legenda das séries (sempre visível com 2 ou mais). Texto na cor do texto, não da série. */
export function ChartLegend({
  series,
  className,
}: {
  series: { key: string; label: string; color: SeriesColor }[];
  className?: string;
}) {
  return (
    <ul
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-neutral-600",
        className,
      )}
    >
      {series.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="h-2 w-3.5 rounded-full"
            style={{ backgroundColor: seriesColor(s.color) }}
          />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

/** Dica flutuante no vidro fumê (mais escura que o fumê comum para ler sobre o claro). */
export function ChartTooltipBox({
  title,
  rows,
}: {
  title: ReactNode;
  rows: { key: string; label: string; value: string; color?: SeriesColor }[];
}) {
  return (
    <div
      className="fume rounded-2xl px-3 py-2 text-xs whitespace-nowrap"
      style={{ backgroundColor: "rgb(14 14 14 / 0.88)" }}
    >
      <p className="mb-1 text-[rgb(255_255_255/0.6)]">{title}</p>
      <ul className="flex flex-col gap-0.5">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center gap-2">
            {r.color !== undefined && (
              <span
                aria-hidden
                className="size-2 rounded-full ring-2 ring-[rgb(255_255_255/0.15)]"
                style={{ backgroundColor: seriesColor(r.color) }}
              />
            )}
            <span className="flex-1 text-[rgb(255_255_255/0.75)]">{r.label}</span>
            <span className="font-semibold text-[#fff] tabular-nums">{r.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

import { TrendingUp } from "lucide-react";
import { useMemo } from "react";
import { cn } from "@/shared/lib/cn";
import { formatHour, formatNumber } from "@/shared/lib/format";

/**
 * Usos por hora, como no painel do lojista do app: colunas claras e o pico
 * em tinta, com o valor em cima. Mostra a janela de horas com movimento
 * (pelo menos 8 colunas). Passar o mouse acende a coluna e mostra o valor.
 */
export function HourBars({
  data,
  unit = "usos",
  description,
  height = "h-40",
}: {
  data: { hour: number; count: number }[];
  /** Plural do que é contado ("usos", "selos"). */
  unit?: string;
  description: string;
  height?: string;
}) {
  const hours = useMemo(() => visibleHours(data), [data]);
  const max = Math.max(0, ...hours.map((h) => h.count));
  const peak = max > 0 ? hours.findIndex((h) => h.count === max) : -1;
  const peakHour = peak >= 0 ? hours[peak]?.hour : undefined;

  if (max === 0) {
    return (
      <p className="py-10 text-center text-sm text-neutral-500">Nenhum registro no período.</p>
    );
  }

  return (
    <figure className="flex flex-col gap-3">
      {peakHour !== undefined && (
        <figcaption className="inline-flex w-fit items-center gap-1.5 rounded-full bg-neutral-900/[0.06] px-2.5 py-1 text-xs font-medium text-neutral-700">
          <TrendingUp className="size-3.5" aria-hidden />
          Pico às {formatHour(peakHour)}
        </figcaption>
      )}
      <div aria-hidden className={cn("flex items-end gap-1.5 pt-8", height)}>
        {hours.map((h, i) => {
          const isPeak = i === peak;
          const pct = Math.max((h.count / max) * 100, h.count > 0 ? 6 : 2);
          return (
            <div
              key={h.hour}
              className="group flex h-full min-w-0 flex-1 flex-col items-center gap-1.5"
            >
              <div className="relative flex w-full flex-1 items-end justify-center">
                <span
                  className={cn(
                    "relative w-full max-w-8 origin-bottom rounded-lg transition-colors motion-safe:animate-[crescer_0.7s_cubic-bezier(.2,.8,.2,1)_both]",
                    isPeak ? "bg-neutral-900" : "bg-neutral-900/15 group-hover:bg-neutral-900/40",
                  )}
                  style={{ height: `${pct}%`, animationDelay: `${i * 35}ms` }}
                >
                  <span
                    className={cn(
                      "absolute -top-7 left-1/2 -translate-x-1/2 rounded-lg bg-neutral-900 px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap text-white",
                      isPeak ? "block" : "hidden group-hover:block",
                    )}
                  >
                    {formatNumber(h.count)} {unit}
                  </span>
                </span>
              </div>
              <small
                className={cn(
                  "text-[11px] text-neutral-500 tabular-nums",
                  hours.length > 12 && i % 2 === 1 && i !== peak && "invisible",
                )}
              >
                {formatHour(h.hour)}
              </small>
            </div>
          );
        })}
      </div>
      <table className="sr-only">
        <caption>{description}</caption>
        <tbody>
          {hours.map((h) => (
            <tr key={h.hour}>
              <th scope="row">{formatHour(h.hour)}</th>
              <td>
                {formatNumber(h.count)} {unit}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** Do primeiro ao último horário com movimento, com no mínimo 8 colunas. */
function visibleHours(data: { hour: number; count: number }[]) {
  const byHour = new Map(data.map((d) => [d.hour, d.count]));
  const active = data.filter((d) => d.count > 0).map((d) => d.hour);
  if (active.length === 0) return [];
  let start = Math.min(...active);
  let end = Math.max(...active);
  while (end - start + 1 < 8) {
    if (start > 0) start--;
    if (end - start + 1 < 8 && end < 23) end++;
    if (start === 0 && end === 23) break;
  }
  return Array.from({ length: end - start + 1 }, (_, i) => ({
    hour: start + i,
    count: byHour.get(start + i) ?? 0,
  }));
}

import { cn } from "@/shared/lib/cn";
import type { PeriodProgress } from "../lib/period";

const MAX_SEGMENTS = 62;

/**
 * Barra do período como a do app (month-bar): um traço por dia, os que já
 * passaram mais fortes e o de hoje em verde. O texto ao lado diz o mesmo.
 */
export function PeriodBar({
  progress,
  draft = false,
}: {
  progress: PeriodProgress;
  /** Rascunho nunca começa sozinho: o texto diz isso em vez de "começa em breve". */
  draft?: boolean;
}) {
  const { day, days } = progress;
  const segments = Math.min(days, MAX_SEGMENTS);
  const scale = days / segments;
  const current = day === 0 ? -1 : Math.ceil(day / scale);
  const text = draft
    ? `Não publicada: não começa sozinha · ${days} dias`
    : day === 0
      ? `Começa em breve · ${days} dias`
      : day >= days && progress.fraction >= 1
        ? `Encerrada · ${days} dias`
        : `Dia ${day} de ${days}`;
  return (
    <div>
      <div aria-hidden className="flex gap-0.5">
        {Array.from({ length: segments }, (_, i) => (
          <i
            // biome-ignore lint/suspicious/noArrayIndexKey: um traço por dia, sem identidade própria
            key={i}
            className={cn(
              "block h-1.5 flex-1 rounded-[2px]",
              i + 1 < current || (current === segments && progress.fraction >= 1)
                ? "bg-neutral-900/50"
                : i + 1 === current
                  ? "scale-y-[1.8] bg-marca"
                  : "bg-neutral-900/[0.1]",
            )}
          />
        ))}
      </div>
      <p className="mt-2 text-xs text-neutral-500 tabular-nums">{text}</p>
    </div>
  );
}

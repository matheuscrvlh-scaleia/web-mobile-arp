import { type LucideIcon, Minus, TrendingDown, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";
import type { Delta } from "@/shared/lib/format";
import type { CardVariant } from "./Card";
import { DEMO_MIXED_HINT, DemoMark } from "./DemoMark";

const TONES: Record<Exclude<CardVariant, "dashed">, string> = {
  glass: "vidro",
  dark: "tom-escuro",
  green: "tom-verde",
};

/**
 * Indicador (como o CartaoIndicador do copiloto): título, número grande e
 * variação contra o período anterior. A variação tem seta e texto, não só
 * cor; `goodWhen` diz se subir é bom.
 */
export function KpiCard({
  label,
  value,
  delta,
  deltaLabel = "vs período anterior",
  goodWhen = "up",
  hint,
  icon: Icon,
  tone = "glass",
  children,
  className,
  onClick,
  onPrefetch,
  demo = false,
}: {
  /** Com onClick, o cartão vira botão (abre o modal "de onde vem"). */
  onClick?: () => void;
  /** Mouse parado em cima, dedo encostado ou foco: hora de pré-carregar. */
  onPrefetch?: () => void;
  /** O número inclui dados fictícios de demonstração (mostra o ícone). */
  demo?: boolean;
  label: string;
  value: ReactNode;
  delta?: Delta | null;
  deltaLabel?: string;
  goodWhen?: "up" | "down";
  hint?: ReactNode;
  icon?: LucideIcon;
  tone?: Exclude<CardVariant, "dashed">;
  children?: ReactNode;
  className?: string;
}) {
  const sense =
    !delta || delta.direction === "flat"
      ? "neutral"
      : (delta.direction === "up") === (goodWhen === "up")
        ? "good"
        : "bad";
  const DeltaIcon =
    !delta || delta.direction === "flat"
      ? Minus
      : delta.direction === "up"
        ? TrendingUp
        : TrendingDown;
  const Root = onClick ? "button" : "div";
  return (
    <Root
      {...(onClick && {
        type: "button" as const,
        onClick,
        onPointerEnter: onPrefetch,
        onFocus: onPrefetch,
        "aria-haspopup": "dialog" as const,
        title: "Ver de onde vem este número",
      })}
      className={cn(
        TONES[tone],
        "flutua relative flex h-full min-w-0 flex-col gap-3 rounded-[1.75rem] p-5",
        onClick &&
          "w-full cursor-pointer text-left transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca",
        className,
      )}
    >
      <p className="flex items-start justify-between gap-2 text-sm font-medium text-neutral-600">
        <span className="inline-flex items-center gap-1.5">
          {label}
          <DemoMark show={demo} hint={DEMO_MIXED_HINT} />
        </span>
        {Icon && (
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-neutral-900/[0.06] text-neutral-700">
            <Icon className="size-4" aria-hidden />
          </span>
        )}
      </p>
      <p className="text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
      <div className="mt-auto flex flex-col gap-1 text-xs text-neutral-500">
        {delta && (
          <span
            className={cn(
              // flex-wrap: rótulo longo desce inteiro para a linha de baixo (não vira coluna).
              "flex flex-wrap items-center gap-x-1 gap-y-0.5 font-medium",
              sense === "good" && "text-green-700",
              sense === "bad" && "text-red-700",
            )}
          >
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              <DeltaIcon className="size-3.5" aria-hidden />
              {delta.text}
            </span>
            <span className="font-normal whitespace-nowrap text-neutral-500">{deltaLabel}</span>
          </span>
        )}
        {hint && <span>{hint}</span>}
      </div>
      {children}
    </Root>
  );
}

import {
  CircleAlert,
  CircleCheck,
  CircleDashed,
  CircleX,
  Info,
  type LucideIcon,
  Sparkles,
} from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

const TONES = {
  success: { icon: CircleCheck, className: "bg-green-50 text-green-700" },
  danger: { icon: CircleX, className: "bg-red-50 text-red-700" },
  warning: { icon: CircleAlert, className: "bg-amber-50 text-amber-900" },
  neutral: { icon: CircleDashed, className: "bg-neutral-900/[0.06] text-neutral-600" },
  info: { icon: Info, className: "bg-sky-50 text-sky-700" },
  brand: { icon: Sparkles, className: "bg-marca/20 text-green-800" },
  dark: { icon: CircleCheck, className: "bg-neutral-900 text-white" },
  /** Laranja (Esgotado). */
  orange: { icon: CircleAlert, className: "bg-orange-50 text-orange-700" },
  /** Cinza-escuro discreto (Encerrado). */
  ended: { icon: CircleCheck, className: "bg-neutral-900/[0.12] text-neutral-800" },
  /** Só contorno (Arquivado). */
  outline: {
    icon: CircleDashed,
    className: "border border-neutral-300 bg-transparent text-neutral-500",
  },
} as const;
export type StatusTone = keyof typeof TONES;

/** Situação com ícone e texto: a cor nunca vem sozinha. */
export function StatusBadge({
  tone,
  icon,
  children,
  className,
}: {
  tone: StatusTone;
  /** Troca o ícone padrão do tom. */
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  const { icon: DefaultIcon, className: toneClass } = TONES[tone];
  const Icon = icon ?? DefaultIcon;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        toneClass,
        className,
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {children}
    </span>
  );
}

/** Contador em pílula (ex.: quantidade ao lado do título). */
export function CountPill({ children, active = false }: { children: ReactNode; active?: boolean }) {
  return (
    <span
      className={cn(
        "inline-grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
        active ? "bg-neutral-900 text-white" : "bg-neutral-900/[0.07] text-neutral-600",
      )}
    >
      {children}
    </span>
  );
}

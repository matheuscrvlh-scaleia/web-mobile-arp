import {
  Archive,
  CalendarClock,
  CircleCheckBig,
  CirclePause,
  type LucideIcon,
  PackageX,
  PencilLine,
  Radio,
} from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { StatusBadge, type StatusTone } from "./StatusBadge";

// Ciclo de vida padrão de tudo que vai para o app (campanha, desafio,
// promoção, evento, destaque, notificação, prêmio):
// Rascunho → Agendado → Ativo → Pausado → Esgotado → Encerrado → Arquivado.
// Cada feature traduz o status dela para um destes e usa o mesmo selo.

export type Lifecycle =
  | "draft"
  | "scheduled"
  | "active"
  | "paused"
  | "soldOut"
  | "ended"
  | "archived";

export const LIFECYCLE: Record<Lifecycle, { label: string; tone: StatusTone; icon: LucideIcon }> = {
  draft: { label: "Rascunho", tone: "neutral", icon: PencilLine },
  scheduled: { label: "Agendado", tone: "info", icon: CalendarClock },
  active: { label: "Ativo", tone: "success", icon: Radio },
  paused: { label: "Pausado", tone: "warning", icon: CirclePause },
  soldOut: { label: "Esgotado", tone: "orange", icon: PackageX },
  ended: { label: "Encerrado", tone: "ended", icon: CircleCheckBig },
  archived: { label: "Arquivado", tone: "outline", icon: Archive },
};

/** Rótulo, tom e ícone do status (para filtros, abas, textos). */
export const lifecycleBadge = (status: Lifecycle) => LIFECYCLE[status];

/**
 * Selo do ciclo de vida, com dica curta opcional ao lado ("termina em 3
 * dias"). `label` troca o texto quando o substantivo pede ("Ativa", "Encerrada").
 */
export function LifecycleBadge({
  status,
  hint,
  label,
  className,
}: {
  status: Lifecycle;
  hint?: string;
  label?: string;
  className?: string;
}) {
  const { label: base, tone, icon } = LIFECYCLE[status];
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-x-2 gap-y-0.5", className)}>
      <StatusBadge tone={tone} icon={icon}>
        {label ?? base}
      </StatusBadge>
      {hint && <span className="text-xs text-neutral-500">{hint}</span>}
    </span>
  );
}

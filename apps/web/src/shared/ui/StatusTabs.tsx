import { cn } from "@/shared/lib/cn";
import type { Lifecycle } from "./LifecycleBadge";
import { Segmented, type TabItem } from "./Tabs";

// Filtro de situação padrão das listas com ciclo de vida (R2G-11): abas em
// pílula com contador, rótulos no plural iguais aos do LifecycleBadge
// ("Ativas", nunca "No ar"). Use o mesmo em todas as listas.

const PLURAL: Record<Lifecycle, [masc: string, fem: string]> = {
  draft: ["Rascunhos", "Rascunhos"],
  scheduled: ["Agendados", "Agendadas"],
  active: ["Ativos", "Ativas"],
  paused: ["Pausados", "Pausadas"],
  soldOut: ["Esgotados", "Esgotadas"],
  ended: ["Encerrados", "Encerradas"],
  archived: ["Arquivados", "Arquivadas"],
};

/** Rótulo da aba: statusTabLabel("active", "a") → "Ativas"; "all" → "Todas". */
export function statusTabLabel(status: Lifecycle | "all", gender: "o" | "a" = "o"): string {
  if (status === "all") return gender === "a" ? "Todas" : "Todos";
  return PLURAL[status][gender === "a" ? 1 : 0];
}

export function StatusTabs<T extends string>({
  options,
  value,
  onChange,
  label = "Filtrar por situação",
  className,
}: {
  /** Cada aba com `count` (quantos itens caem nela). */
  options: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  label?: string;
  className?: string;
}) {
  return (
    <Segmented
      label={label}
      size="sm"
      options={options}
      value={value}
      onChange={onChange}
      className={cn("mb-5", className)}
    />
  );
}

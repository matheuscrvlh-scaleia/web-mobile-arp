import type { Highlight, HighlightBadge, HighlightStatus, HighlightTarget } from "@arp/contracts";
import { Megaphone, Sparkles } from "lucide-react";
import { type Lifecycle, LifecycleBadge, StatusBadge } from "@/shared/ui";

export const HIGHLIGHT_STATUS_LABEL: Record<HighlightStatus, string> = {
  draft: "Rascunho",
  published: "Ativo",
  paused: "Pausado",
  archived: "Arquivado",
};

export const BADGE_LABEL: Record<HighlightBadge, string> = {
  featured: "Destaque",
  sponsored: "Patrocinado",
};

export const TARGET_LABEL: Record<HighlightTarget, string> = {
  event: "Evento",
  coupon: "Cupom",
  store: "Loja",
  url: "Link",
  none: "Sem destino",
};

/** Texto do botão quando o destaque não define um. */
export const DEFAULT_CTA: Record<HighlightTarget, string | null> = {
  event: "Ver evento",
  coupon: "Pegar cupom",
  store: "Ver loja",
  url: "Saiba mais",
  none: null,
};

/** Destaque (da ARP) ou Patrocinado (mídia paga), como a pílula do app. */
export function KindBadge({ badge }: { badge: HighlightBadge }) {
  return badge === "sponsored" ? (
    <StatusBadge tone="dark" icon={Megaphone}>
      Patrocinado
    </StatusBadge>
  ) : (
    <StatusBadge tone="brand" icon={Sparkles}>
      Destaque
    </StatusBadge>
  );
}

/** Ciclo de vida do destaque: publicado vira Agendado / Ativo / Encerrado pela data. */
export function highlightLifecycle(h: Pick<Highlight, "status" | "phase">): Lifecycle {
  if (h.status === "draft") return "draft";
  if (h.status === "archived") return "archived";
  if (h.phase === "ended") return "ended";
  if (h.status === "paused") return "paused";
  return h.phase === "upcoming" ? "scheduled" : "active";
}

/** Situação: publicado mostra a fase (ativo, agendado, encerrado). */
export function HighlightStateBadge({
  highlight,
}: {
  highlight: Pick<Highlight, "status" | "phase">;
}) {
  const lifecycle = highlightLifecycle(highlight);
  return <LifecycleBadge status={lifecycle} />;
}

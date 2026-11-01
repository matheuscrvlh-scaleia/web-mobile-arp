import type { Highlight, HighlightBadge, HighlightStatus, HighlightTarget } from "@arp/contracts";
import { Archive, CircleDashed, Megaphone, Sparkles } from "lucide-react";
import { PhaseBadge, StatusBadge } from "@/shared/ui";

export const HIGHLIGHT_STATUS_LABEL: Record<HighlightStatus, string> = {
  draft: "Rascunho",
  published: "Publicado",
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

/** Situação: publicado mostra a fase (no ar, em breve, encerrado). */
export function HighlightStateBadge({
  highlight,
}: {
  highlight: Pick<Highlight, "status" | "phase">;
}) {
  if (highlight.status === "draft")
    return (
      <StatusBadge tone="neutral" icon={CircleDashed}>
        Rascunho
      </StatusBadge>
    );
  if (highlight.status === "archived")
    return (
      <StatusBadge tone="neutral" icon={Archive}>
        Arquivado
      </StatusBadge>
    );
  return <PhaseBadge phase={highlight.phase} ended="Encerrado" />;
}

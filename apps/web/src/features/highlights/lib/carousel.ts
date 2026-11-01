import type { Highlight } from "@arp/contracts";
import type { SlideContent } from "../components/HighlightSlide";

/**
 * Vizinho e tamanho do carrossel para a prévia: os slides no ar, na ordem;
 * o "próximo" é o que vem depois deste (ou o primeiro, se este é novo).
 */
export function carouselContext(
  all: Highlight[] | undefined,
  currentId?: string,
): { next?: SlideContent; total: number } {
  const live = (all ?? []).filter(
    (h) => h.id !== currentId && h.status === "published" && h.phase === "live",
  );
  if (!currentId) return { next: live[0], total: live.length + 1 };
  const order = all ?? [];
  const index = order.findIndex((h) => h.id === currentId);
  const after = order.slice(index + 1).find((h) => live.includes(h));
  return { next: after ?? live[0], total: live.length + 1 };
}

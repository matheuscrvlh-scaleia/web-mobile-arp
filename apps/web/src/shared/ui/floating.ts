// Posição de painéis flutuantes (menu "⋯", lista do Combobox): presos ao
// botão/campo, sem sair da tela. Dentro de um <dialog> vão para o próprio
// dialog (a camada de cima); fora, para o <body>.

const GAP = 6;
const MARGIN = 8;

/** Onde montar o painel (portal): o <dialog> aberto em volta, ou o body. */
export function floatingHost(anchor: HTMLElement | null): HTMLElement {
  return anchor?.closest("dialog") ?? document.body;
}

/**
 * top/left (position: fixed) para um painel de `width` x `height` preso ao
 * `anchor`: embaixo; sem espaço embaixo, em cima; nunca fora da tela.
 */
export function placeNear(
  anchor: DOMRect,
  width: number,
  height: number,
  align: "start" | "end" = "start",
): { top: number; left: number; maxHeight: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let left = align === "end" ? anchor.right - width : anchor.left;
  left = Math.max(MARGIN, Math.min(left, vw - width - MARGIN));
  const spaceBelow = vh - anchor.bottom - GAP - MARGIN;
  const spaceAbove = anchor.top - GAP - MARGIN;
  if (height <= spaceBelow || spaceBelow >= spaceAbove) {
    return { top: anchor.bottom + GAP, left, maxHeight: Math.max(spaceBelow, 120) };
  }
  const h = Math.min(height, spaceAbove);
  return { top: anchor.top - GAP - h, left, maxHeight: spaceAbove };
}

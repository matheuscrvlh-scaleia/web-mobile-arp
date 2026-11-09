import "driver.js/dist/driver.css";
import type { Driver, DriveStep } from "driver.js";
import { Compass } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router";
import { guideFor, seenKey, type Target } from "../guides";

const visible = (el: Element) => el.getClientRects().length > 0;

/** O primeiro elemento visível com o alvo (fora: gaveta fechada, sem permissão, sem dado). */
function targetOnScreen(target: Target): Element | undefined {
  const el = [...document.querySelectorAll(`[data-guia="${target}"]`)].find(visible);
  if (el || target !== "linha") return el;
  // Lista em cartões (sem a Table): a linha é o primeiro item da lista.
  const list = [...document.querySelectorAll('[data-guia="tabela"]')].find(visible);
  return list ? [...list.querySelectorAll("li")].find(visible) : undefined;
}

function markSeen(key: string, version: number) {
  try {
    localStorage.setItem(seenKey(key), String(version));
  } catch {
    // Sem armazenamento: o ponto de novidade volta ao recarregar.
  }
}

/**
 * Botão "Guia" da barra do topo (como no copiloto): abre o passo a passo da
 * tela atual. Não abre sozinho; um ponto verde avisa quando há guia que a
 * pessoa ainda não viu (ou que mudou). Atalho: tecla "?". Passo cujo ponto
 * não está na tela (sem permissão, sem dado, menu recolhido no celular) é
 * pulado, e a contagem "2 de 5" conta só o que aparece.
 */
export function GuideButton() {
  const { pathname, search } = useLocation();
  const current = useMemo(() => guideFor(pathname, search), [pathname, search]);
  const [isNew, setIsNew] = useState(false);
  const active = useRef<Driver | null>(null);

  useEffect(() => {
    if (!current) return;
    try {
      setIsNew(localStorage.getItem(seenKey(current.key)) !== String(current.guide.version));
    } catch {
      setIsNew(false);
    }
    // Mudou de tela com o guia aberto: fecha, os pontos eram da tela anterior.
    return () => active.current?.destroy();
  }, [current]);

  const open = useCallback(async () => {
    if (!current || active.current?.isActive()) return;
    const { driver } = await import("driver.js");
    const steps: DriveStep[] = current.steps.flatMap((s) => {
      const popover = { title: s.title, description: s.text };
      if (!s.target) return [{ popover }];
      const element = targetOnScreen(s.target);
      return element ? [{ element, popover }] : [];
    });
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const d = driver({
      steps,
      showProgress: steps.length > 1,
      progressText: "{{current}} de {{total}}",
      nextBtnText: "Próximo",
      prevBtnText: "Voltar",
      doneBtnText: "Concluir",
      closeBtnLabel: "Fechar o guia",
      popoverClass: "guia-popover",
      popoverOffset: 12,
      stagePadding: 6,
      stageRadius: 22,
      overlayOpacity: 0.5,
      animate: !still,
      smoothScroll: !still,
      onDestroyed: () => {
        active.current = null;
        markSeen(current.key, current.guide.version);
        setIsNew(false);
      },
    });
    active.current = d;
    d.drive();
  }, [current]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "?" || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, [contenteditable='true']")) return;
      e.preventDefault();
      void open();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (!current) return null;

  return (
    <button
      type="button"
      data-guia="guia"
      onClick={() => void open()}
      aria-keyshortcuts="?"
      title="Guia desta tela (tecla ?)"
      className="vidro relative flex shrink-0 cursor-pointer items-center gap-2 rounded-full p-1.5 text-sm text-neutral-700 transition hover:text-neutral-900 sm:pr-4"
    >
      <span className="grid size-8 place-items-center rounded-full bg-neutral-900 text-white">
        <Compass className="size-4" aria-hidden />
      </span>
      <span className="sr-only sm:not-sr-only">Guia</span>
      {isNew && (
        <span className="absolute top-0.5 right-0.5 flex size-2.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-marca opacity-75 motion-reduce:animate-none" />
          <span className="relative inline-flex size-2.5 rounded-full bg-marca ring-2 ring-white" />
          <span className="sr-only">(novo)</span>
        </span>
      )}
    </button>
  );
}

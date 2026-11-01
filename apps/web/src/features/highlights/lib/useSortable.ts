import {
  type DragEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

function moveTo(list: string[], id: string, to: number): string[] {
  const from = list.indexOf(id);
  if (from < 0 || to < 0 || to >= list.length || from === to) return list;
  const next = list.slice();
  next.splice(from, 1);
  next.splice(to, 0, id);
  return next;
}

const same = (a: string[], b: string[]) => a.length === b.length && a.every((v, i) => v === b[i]);

/**
 * Ordenar uma lista arrastando (mouse, HTML5 drag and drop) ou pelo teclado
 * (padrão "pegar e soltar": Espaço/Enter pega, setas movem, Espaço/Enter
 * solta, Esc cancela), com anúncios para leitores de tela. A ordem só é
 * enviada (`onCommit`) quando o item é solto numa posição nova.
 */
export function useSortable({
  ids,
  labelOf,
  onCommit,
  enabled,
}: {
  ids: string[];
  labelOf: (id: string) => string;
  onCommit: (ids: string[]) => void;
  enabled: boolean;
}) {
  const [draft, setDraft] = useState<string[] | null>(null);
  const [grabbed, setGrabbed] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const handles = useRef(new Map<string, HTMLButtonElement>());
  const order = draft ?? ids;
  const position = (list: string[], id: string) =>
    `posição ${list.indexOf(id) + 1} de ${list.length}`;

  // O item movido pelo teclado continua com o foco depois de trocar de lugar.
  useEffect(() => {
    if (grabbed && draft) handles.current.get(grabbed)?.focus();
  }, [grabbed, draft]);

  const finish = useCallback(
    (list: string[]) => {
      setDraft(null);
      setGrabbed(null);
      setDragging(null);
      if (!same(list, ids)) onCommit(list);
    },
    [ids, onCommit],
  );

  const onHandleKeyDown = (e: KeyboardEvent, id: string) => {
    if (!enabled) return;
    const label = labelOf(id);
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      if (grabbed === id) {
        setMessage(`${label} solto na ${position(order, id)}.`);
        finish(order);
      } else {
        setDraft(ids);
        setGrabbed(id);
        setMessage(
          `${label} pego, ${position(ids, id)}. Use as setas para mover, Espaço para soltar, Esc para cancelar.`,
        );
      }
      return;
    }
    if (grabbed !== id) return;
    const index = order.indexOf(id);
    const to =
      e.key === "ArrowUp" || e.key === "ArrowLeft"
        ? index - 1
        : e.key === "ArrowDown" || e.key === "ArrowRight"
          ? index + 1
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? order.length - 1
              : null;
    if (to !== null) {
      e.preventDefault();
      const next = moveTo(order, id, to);
      setDraft(next);
      setMessage(`${label}: ${position(next, id)}.`);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setDraft(null);
      setGrabbed(null);
      setMessage(`Cancelado. ${label} voltou para a ${position(ids, id)}.`);
    }
  };

  /** Botões "subir/descer" (toque e quem prefere clicar): salvam na hora. */
  const nudge = (id: string, delta: -1 | 1) => {
    const next = moveTo(ids, id, ids.indexOf(id) + delta);
    if (next !== ids) {
      setMessage(`${labelOf(id)}: ${position(next, id)}.`);
      onCommit(next);
    }
  };

  const itemProps = (id: string) =>
    enabled
      ? {
          draggable: true,
          onDragStart: (e: DragEvent) => {
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", id);
            setDraft(ids);
            setDragging(id);
          },
          onDragOver: (e: DragEvent) => {
            if (!dragging) return;
            e.preventDefault();
            if (dragging !== id)
              setDraft((d) => moveTo(d ?? ids, dragging, (d ?? ids).indexOf(id)));
          },
          onDrop: (e: DragEvent) => e.preventDefault(),
          onDragEnd: () => {
            if (dragging) {
              setMessage(`${labelOf(dragging)} solto na ${position(order, dragging)}.`);
              finish(order);
            }
          },
        }
      : {};

  const handleRef = (id: string) => (el: HTMLButtonElement | null) => {
    if (el) handles.current.set(id, el);
    else handles.current.delete(id);
  };

  return {
    order,
    grabbed,
    dragging,
    message,
    onHandleKeyDown,
    itemProps,
    handleRef,
    nudge,
  };
}

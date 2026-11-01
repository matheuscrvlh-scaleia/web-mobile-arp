import type { MapShape, MapShapeKind } from "@arp/contracts";
import {
  type PointerEvent,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { clamp, SHAPE_KIND_LABEL, snap, useSvgPoint, VIEW_H, VIEW_W } from "./map-canvas";

type Pt = { x: number; y: number };

export type Selection =
  | { type: "store"; id: string }
  | { type: "point"; id: string }
  | { type: "shape"; index: number }
  | null;

/** Esperando um clique no mapa para pôr algo (loja sem lugar ou ponto novo). */
export type Placing = { type: "store"; id: string } | { type: "point" } | null;

export type DragStart =
  | { type: "store" | "point"; id: string; origin: Pt }
  | { type: "shape-move" | "shape-resize"; index: number };

type Drag =
  | { type: "store" | "point"; id: string; origin: Pt; start: Pt; moved: boolean }
  | {
      type: "shape-move" | "shape-resize";
      index: number;
      origin: MapShape;
      start: Pt;
      moved: boolean;
    };

/** Onde o item arrastado está agora (ainda não salvo). */
export type DragPreview =
  | { type: "store" | "point"; id: string; pos: Pt }
  | { type: "shape"; index: number; shape: MapShape }
  | null;

const MIN_SIZE = 8;
/** Abaixo disso (em unidades do desenho) é clique, não arraste. */
const CLICK_SLOP = 2;

const samePosition = (a: MapShape[], b: MapShape[]) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Prévia do arraste fora do estado do React: muda a cada quadro e só o
 * desenho do mapa a escuta (`useDragPreview`); a página e os painéis só
 * renderizam de novo quando a pessoa solta.
 */
function createPreviewStore() {
  let value: DragPreview = null;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set(next: DragPreview) {
      value = next;
      for (const l of listeners) l();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** Posição/forma do item a partir do ponto atual do ponteiro. */
function dragResult(d: Drag, p: Pt): DragPreview {
  const dx = p.x - d.start.x;
  const dy = p.y - d.start.y;
  if ("id" in d) {
    const o = d.origin;
    return {
      type: d.type,
      id: d.id,
      pos: { x: clamp(snap(o.x + dx), 0, VIEW_W), y: clamp(snap(o.y + dy), 0, VIEW_H) },
    };
  }
  const o = d.origin;
  const shape: MapShape =
    d.type === "shape-move"
      ? {
          ...o,
          x: clamp(snap(o.x + dx), 0, VIEW_W - o.w),
          y: clamp(snap(o.y + dy), 0, VIEW_H - o.h),
        }
      : {
          ...o,
          w: clamp(snap(o.w + dx), MIN_SIZE, VIEW_W - o.x),
          h: clamp(snap(o.h + dy), MIN_SIZE, VIEW_H - o.y),
        };
  return { type: "shape", index: d.index, shape };
}

/**
 * Estado e gestos do editor do mapa: seleção, arrastar pinos e pontos,
 * mover/redimensionar formas do desenho (rascunho local até salvar) e
 * posicionar algo novo com um clique. O arraste roda num quadro por vez
 * (requestAnimationFrame) e só confirma ao soltar.
 */
export function useMapEditor({
  svgRef,
  floorId,
  savedLayout,
  onMoveStore,
  onMovePoint,
  onPlace,
}: {
  svgRef: RefObject<SVGSVGElement | null>;
  floorId: string | undefined;
  savedLayout: MapShape[];
  onMoveStore: (id: string, pos: Pt) => void;
  onMovePoint: (id: string, pos: Pt) => void;
  onPlace: (placing: NonNullable<Placing>, pos: Pt) => void;
}) {
  const toSvg = useSvgPoint(svgRef);
  const [selection, setSelection] = useState<Selection>(null);
  const [placing, setPlacing] = useState<Placing>(null);
  const [layout, setLayout] = useState<MapShape[]>(savedLayout);
  const [preview] = useState(createPreviewStore);
  const dragRef = useRef<Drag | null>(null);
  const lastPointer = useRef<Pt | null>(null);
  const frame = useRef(0);
  // Setas: o pino anda na tela na hora e só salva quando a pessoa para.
  const [keyDraft, setKeyDraft] = useState<{ type: "store" | "point"; id: string; pos: Pt } | null>(
    null,
  );
  const keyTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(
    () => () => {
      clearTimeout(keyTimer.current);
      cancelAnimationFrame(frame.current);
    },
    [],
  );

  // Trocou de andar: recomeça do desenho salvo daquele andar.
  const [layoutFloor, setLayoutFloor] = useState(floorId);
  // O salvo mudou (salvou aqui ou em outra aba): acompanha se não há rascunho.
  const [lastSaved, setLastSaved] = useState(savedLayout);
  if (layoutFloor !== floorId) {
    setLayoutFloor(floorId);
    setLastSaved(savedLayout);
    setLayout(savedLayout);
    setSelection(null);
    setPlacing(null);
  } else if (lastSaved !== savedLayout) {
    setLastSaved(savedLayout);
    if (samePosition(layout, lastSaved)) setLayout(savedLayout);
  }

  const layoutDirty = !samePosition(layout, savedLayout);

  const point = (e: PointerEvent): Pt | null => toSvg(e.clientX, e.clientY);

  /** Começa a arrastar um item (pino, ponto, forma ou a alça de tamanho). */
  const startDrag = (e: PointerEvent, target: DragStart) => {
    if (placing || e.button !== 0) return;
    e.stopPropagation();
    const p = point(e);
    if (!p) return;
    if ("id" in target) {
      dragRef.current = { ...target, start: p, moved: false };
    } else {
      const origin = layout[target.index];
      if (!origin) return;
      dragRef.current = { ...target, origin, start: p, moved: false };
    }
    svgRef.current?.setPointerCapture(e.pointerId);
  };

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    const p = point(e);
    if (!p) return;
    if (placing) {
      onPlace(placing, { x: clamp(snap(p.x), 0, VIEW_W), y: clamp(snap(p.y), 0, VIEW_H) });
      setPlacing(null);
      return;
    }
    setSelection(null);
  };

  const applyPointer = () => {
    frame.current = 0;
    const d = dragRef.current;
    const p = lastPointer.current;
    if (!d || !p) return;
    if (!d.moved) {
      const far = Math.abs(p.x - d.start.x) > CLICK_SLOP || Math.abs(p.y - d.start.y) > CLICK_SLOP;
      if (!far) return;
      d.moved = true;
    }
    preview.set(dragResult(d, p));
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!dragRef.current) return;
    lastPointer.current = point(e);
    if (!frame.current) frame.current = requestAnimationFrame(applyPointer);
  };

  const onPointerUp = () => {
    const d = dragRef.current;
    if (!d) return;
    cancelAnimationFrame(frame.current);
    applyPointer();
    const result = d.moved ? preview.get() : null;
    dragRef.current = null;
    lastPointer.current = null;
    preview.set(null);
    if ("id" in d) {
      setSelection({ type: d.type, id: d.id });
      if (result && result.type !== "shape") {
        (d.type === "store" ? onMoveStore : onMovePoint)(d.id, result.pos);
      }
      return;
    }
    setSelection({ type: "shape", index: d.index });
    if (result?.type === "shape") {
      setLayout((l) => l.map((s, i) => (i === result.index ? result.shape : s)));
    }
  };

  /** Setas movem o que está selecionado (Shift anda 10). */
  const nudge = useCallback(
    (dx: number, dy: number, current: Pt | null) => {
      if (!selection) return;
      if (selection.type === "shape") {
        setLayout((l) =>
          l.map((s, i) =>
            i === selection.index
              ? { ...s, x: clamp(s.x + dx, 0, VIEW_W - s.w), y: clamp(s.y + dy, 0, VIEW_H - s.h) }
              : s,
          ),
        );
        return;
      }
      const base =
        keyDraft && keyDraft.type === selection.type && keyDraft.id === selection.id
          ? keyDraft.pos
          : current;
      if (!base) return;
      const pos = { x: clamp(base.x + dx, 0, VIEW_W), y: clamp(base.y + dy, 0, VIEW_H) };
      const target = { type: selection.type, id: selection.id, pos };
      setKeyDraft(target);
      clearTimeout(keyTimer.current);
      keyTimer.current = setTimeout(() => {
        (target.type === "store" ? onMoveStore : onMovePoint)(target.id, target.pos);
        setKeyDraft(null);
      }, 600);
    },
    [selection, keyDraft, onMoveStore, onMovePoint],
  );

  const updateShape = (index: number, patch: Partial<MapShape>) =>
    setLayout((l) => l.map((s, i) => (i === index ? { ...s, ...patch } : s)));

  const addShape = (kind: MapShapeKind) => {
    const shape: MapShape = { kind, label: SHAPE_KIND_LABEL[kind], x: 130, y: 200, w: 100, h: 60 };
    setLayout((l) => [...l, shape]);
    setSelection({ type: "shape", index: layout.length });
  };

  const removeShape = (index: number) => {
    setLayout((l) => l.filter((_, i) => i !== index));
    setSelection(null);
  };

  /** Ordem de desenho: para frente fica por cima. */
  const moveShape = (index: number, dir: -1 | 1) => {
    const to = index + dir;
    if (to < 0 || to >= layout.length) return;
    setLayout((l) => {
      const next = [...l];
      const [item] = next.splice(index, 1);
      if (item) next.splice(to, 0, item);
      return next;
    });
    setSelection({ type: "shape", index: to });
  };

  return {
    selection,
    setSelection,
    placing,
    setPlacing,
    preview,
    keyDraft,
    layout,
    layoutDirty,
    resetLayout: () => {
      setLayout(savedLayout);
      setSelection(null);
    },
    startDrag,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    nudge,
    updateShape,
    addShape,
    removeShape,
    moveShape,
  };
}

export type MapEditor = ReturnType<typeof useMapEditor>;

/**
 * Prévia do arraste para o desenho: o componente que chama renderiza a
 * cada quadro do arraste; os demais, não.
 */
export function useDragPreview(editor: MapEditor) {
  const preview = useSyncExternalStore(editor.preview.subscribe, editor.preview.get);
  const { keyDraft } = editor;
  /** Posição provisória (arrastando ou andando pelas setas), se houver. */
  const positionOf = (type: "store" | "point", id: string): Pt | null => {
    if (preview && preview.type !== "shape" && preview.type === type && preview.id === id) {
      return preview.pos;
    }
    if (keyDraft && keyDraft.type === type && keyDraft.id === id) return keyDraft.pos;
    return null;
  };
  const shapeAt = (index: number, shape: MapShape) =>
    preview?.type === "shape" && preview.index === index ? preview.shape : shape;
  return { positionOf, shapeAt };
}

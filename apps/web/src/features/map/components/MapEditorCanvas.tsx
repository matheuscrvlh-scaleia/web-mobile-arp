import type { MapPoint } from "@arp/contracts";
import type { KeyboardEvent, RefObject } from "react";
import { cn } from "@/shared/lib/cn";
import type { PlacedPin } from "../api";
import { FloorPlanImage, MapCanvas, MapPointMark, MapShapeView, StorePinMark } from "./map-canvas";
import { type MapEditor, useDragPreview } from "./useMapEditor";

export type EditorMode = "pinos" | "desenho";

/**
 * O desenho do andar com tudo o que dá para mexer. No modo "pinos", lojas
 * e pontos arrastam; no modo "desenho", as formas movem e a alça do canto
 * muda o tamanho. Pelo teclado: escolha o item na lista ao lado, foque o
 * mapa e use as setas (Shift anda mais); Esc cancela.
 */
export function MapEditorCanvas({
  svgRef,
  editor,
  mode,
  pins,
  points,
  floorLabel,
  canMoveStores,
  canEditMap,
  backgroundUrl,
}: {
  svgRef: RefObject<SVGSVGElement | null>;
  editor: MapEditor;
  mode: EditorMode;
  pins: PlacedPin[];
  points: MapPoint[];
  floorLabel: string;
  canMoveStores: boolean;
  canEditMap: boolean;
  /** Planta do andar, de fundo (só no painel). */
  backgroundUrl?: string | null | undefined;
}) {
  const { selection, placing, layout } = editor;
  const { positionOf, shapeAt } = useDragPreview(editor);
  const drawing = mode === "desenho";

  const selectedPos = () => {
    if (!selection) return null;
    if (selection.type === "store") {
      const p = pins.find((x) => x.store.id === selection.id);
      return positionOf("store", selection.id) ?? (p ? { x: p.x, y: p.y } : null);
    }
    if (selection.type === "point") {
      const p = points.find((x) => x.id === selection.id);
      return positionOf("point", selection.id) ?? (p ? { x: p.x, y: p.y } : null);
    }
    return null;
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      editor.setPlacing(null);
      editor.setSelection(null);
      return;
    }
    if ((e.key === "Delete" || e.key === "Backspace") && drawing && selection?.type === "shape") {
      e.preventDefault();
      editor.removeShape(selection.index);
      return;
    }
    const step = e.shiftKey ? 10 : 2;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const m = moves[e.key];
    if (!m || !selection) return;
    const allowed =
      (selection.type === "shape" && canEditMap) ||
      (selection.type === "point" && canEditMap) ||
      (selection.type === "store" && canMoveStores);
    if (!allowed) return;
    e.preventDefault();
    editor.nudge(m[0], m[1], selectedPos());
  };

  const help = placing
    ? "Clique no mapa para posicionar. Esc cancela."
    : "Escolha um item na lista ao lado e use as setas para mover; Shift anda mais.";

  return (
    <MapCanvas
      ref={svgRef}
      title={`Mapa do ${floorLabel}`}
      tabIndex={0}
      role="application"
      aria-roledescription="editor de mapa"
      aria-label={`Mapa do ${floorLabel}. ${help}`}
      onPointerDown={editor.onPointerDown}
      onPointerMove={editor.onPointerMove}
      onPointerUp={editor.onPointerUp}
      onPointerCancel={editor.onPointerUp}
      onKeyDown={onKeyDown}
      className={cn(
        "block h-auto max-h-[calc(100dvh-12rem)] w-full touch-none rounded-[1.4rem] outline-none select-none focus-visible:ring-4 focus-visible:ring-marca/40",
        placing && "cursor-crosshair",
      )}
    >
      {backgroundUrl && <FloorPlanImage url={backgroundUrl} opacity={drawing ? 0.55 : 0.3} />}
      <g key={floorLabel} className="mapa-camada">
        {layout.map((saved, i) => {
          const shape = shapeAt(i, saved);
          const selected = drawing && selection?.type === "shape" && selection.index === i;
          return (
            <g
              // biome-ignore lint/suspicious/noArrayIndexKey: formas sem id; a ordem é a identidade
              key={i}
              onPointerDown={
                drawing && canEditMap
                  ? (e) => editor.startDrag(e, { type: "shape-move", index: i })
                  : undefined
              }
              style={{ cursor: drawing && canEditMap ? "move" : undefined }}
              opacity={drawing ? 1 : 0.95}
            >
              <MapShapeView shape={shape} />
              {selected && (
                <>
                  <rect
                    x={shape.x - 3}
                    y={shape.y - 3}
                    width={shape.w + 6}
                    height={shape.h + 6}
                    rx="20"
                    fill="none"
                    stroke="var(--color-marca)"
                    strokeWidth="2"
                    strokeDasharray="6 4"
                    pointerEvents="none"
                  />
                  {canEditMap && (
                    <circle
                      cx={shape.x + shape.w}
                      cy={shape.y + shape.h}
                      r="7"
                      fill="#fff"
                      stroke="var(--color-marca-escuro)"
                      strokeWidth="2.5"
                      style={{ cursor: "nwse-resize" }}
                      onPointerDown={(e) => editor.startDrag(e, { type: "shape-resize", index: i })}
                    >
                      <title>Arraste para mudar o tamanho</title>
                    </circle>
                  )}
                </>
              )}
            </g>
          );
        })}

        <g opacity={drawing ? 0.35 : 1} pointerEvents={drawing ? "none" : undefined}>
          {points.map((p) => {
            const pos = positionOf("point", p.id) ?? p;
            return (
              <MapPointMark
                key={p.id}
                x={pos.x}
                y={pos.y}
                icon={p.icon}
                selected={selection?.type === "point" && selection.id === p.id}
                style={{ cursor: canEditMap ? "grab" : "pointer" }}
                onPointerDown={(e) => {
                  if (canEditMap) {
                    editor.startDrag(e, { type: "point", id: p.id, origin: { x: p.x, y: p.y } });
                    return;
                  }
                  e.stopPropagation();
                  editor.setSelection({ type: "point", id: p.id });
                }}
              >
                <title>{p.label}</title>
              </MapPointMark>
            );
          })}
          {pins.map((pin) => {
            const pos = positionOf("store", pin.store.id) ?? pin;
            const selected = selection?.type === "store" && selection.id === pin.store.id;
            return (
              <StorePinMark
                key={pin.store.id}
                x={pos.x}
                y={pos.y}
                color={pin.store.brandColor}
                icon={pin.store.icon}
                name={pin.store.name}
                selected={selected}
                dimmed={pin.store.status === "inactive"}
                style={{ cursor: canMoveStores ? "grab" : "pointer" }}
                onPointerDown={(e) => {
                  if (canMoveStores) {
                    editor.startDrag(e, {
                      type: "store",
                      id: pin.store.id,
                      origin: { x: pin.x, y: pin.y },
                    });
                    return;
                  }
                  e.stopPropagation();
                  editor.setSelection({ type: "store", id: pin.store.id });
                }}
              >
                {!selected && <title>{pin.store.name}</title>}
              </StorePinMark>
            );
          })}
        </g>
      </g>
    </MapCanvas>
  );
}

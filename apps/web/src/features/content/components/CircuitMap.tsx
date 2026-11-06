import { ImageOff, MapPin } from "lucide-react";
import { type KeyboardEvent, type PointerEvent, useRef, useState } from "react";
import { cn } from "@/shared/lib/cn";
import { ImageUpload, toast } from "@/shared/ui";
import { useUpdateContentPage } from "../api";

export interface MapPoint {
  id: string;
  number: number;
  name: string;
  x: number;
  y: number;
}

/** Posição em % (0–100) com uma casa, como o app guarda. */
const clamp = (v: number) => Math.round(Math.min(100, Math.max(0, v)) * 10) / 10;

function percentAt(el: HTMLElement, clientX: number, clientY: number) {
  const r = el.getBoundingClientRect();
  return {
    x: clamp(((clientX - r.left) / r.width) * 100),
    y: clamp(((clientY - r.top) / r.height) * 100),
  };
}

/**
 * Sem a imagem do mapa: explica e deixa enviar ali mesmo (salva na hora no
 * texto do Circuito, o mesmo campo de Textos → Circuito Cultural).
 */
export function NoMapImage({ canEdit = true }: { canEdit?: boolean }) {
  const save = useUpdateContentPage();
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
      <p className="flex items-start gap-3">
        <ImageOff className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          <b className="font-semibold">Envie a imagem do mapa do Circuito.</b> Sem ela, não dá para
          posicionar os pontos no mapa do app.
          {!canEdit && " Peça a quem cuida do conteúdo."}
        </span>
      </p>
      {canEdit && (
        <ImageUpload
          label="mapa do Circuito"
          value={null}
          disabled={save.isPending}
          onChange={(url) =>
            url &&
            save.mutateAsync({ key: "circuit", body: { fileUrl: url } }).then(
              () => toast.success("Mapa do Circuito salvo: clique no mapa para pôr cada ponto."),
              (e) => toast.fromError(e),
            )
          }
        />
      )}
    </div>
  );
}

/**
 * O mapa do Circuito com os pinos. Com `value`/`onChange`, clicar no mapa
 * (ou arrastar o pino) define a posição do ponto em edição; as setas do
 * teclado movem o pino. Os outros pontos aparecem apagados, para referência.
 */
export function CircuitMap({
  imageUrl,
  points,
  value,
  onChange,
  label,
  onPointClick,
  className,
}: {
  imageUrl: string;
  points: MapPoint[];
  /** Ponto em edição (null = ainda sem posição). */
  value?: { x: number; y: number } | null;
  onChange?: (pos: { x: number; y: number }) => void;
  label?: string;
  /** Visão geral: clicar num pino abre o ponto. */
  onPointClick?: (id: string) => void;
  className?: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const editing = Boolean(onChange);

  const place = (e: PointerEvent) => {
    if (!onChange || !boxRef.current) return;
    onChange(percentAt(boxRef.current, e.clientX, e.clientY));
  };

  const onKey = (e: KeyboardEvent) => {
    if (!onChange || !value) return;
    const step = e.shiftKey ? 5 : 0.5;
    const d = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    }[e.key];
    if (!d) return;
    e.preventDefault();
    onChange({ x: clamp(value.x + (d[0] ?? 0)), y: clamp(value.y + (d[1] ?? 0)) });
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-neutral-200 bg-white",
        className,
      )}
    >
      <div
        ref={boxRef}
        className={cn("relative select-none", editing && "cursor-crosshair touch-none")}
        onPointerDown={(e) => {
          if (!editing) return;
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          setDragging(true);
          place(e);
        }}
        onPointerMove={(e) => dragging && place(e)}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
      >
        <img
          src={imageUrl}
          alt="Mapa do Circuito Cultural"
          draggable={false}
          className="block w-full"
        />
        {points.map((p) => (
          <button
            key={p.id}
            type="button"
            tabIndex={onPointClick ? 0 : -1}
            aria-hidden={onPointClick ? undefined : true}
            title={`${p.number}. ${p.name}`}
            onClick={onPointClick ? () => onPointClick(p.id) : undefined}
            onPointerDown={(e) => onPointClick && e.stopPropagation()}
            className={cn(
              "absolute grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white text-[10px] font-bold text-white shadow",
              editing ? "pointer-events-none bg-neutral-500/70" : "bg-neutral-900 hover:scale-110",
            )}
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
          >
            {p.number}
          </button>
        ))}
        {editing && value && (
          <button
            type="button"
            role="slider"
            aria-label={`${label ?? "Ponto"}: posição no mapa`}
            aria-valuetext={`${value.x}% da esquerda, ${value.y}% do topo`}
            aria-valuenow={value.x}
            onKeyDown={onKey}
            className="absolute -translate-x-1/2 -translate-y-full text-red-600 drop-shadow focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ left: `${value.x}%`, top: `${value.y}%` }}
          >
            <MapPin className="size-9 fill-red-600 stroke-white" aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}

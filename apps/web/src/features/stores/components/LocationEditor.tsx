import type { StoreDetail } from "@arp/contracts";
import { ExternalLink, MapPinOff, MousePointerClick } from "lucide-react";
import { type KeyboardEvent, type PointerEvent, useRef, useState } from "react";
import {
  clamp,
  MapCanvas,
  MapPointMark,
  MapShapeView,
  StorePinMark,
  snap,
  useFloorPins,
  useFloors,
  useMapPoints,
  useSvgPoint,
  VIEW_H,
  VIEW_W,
} from "@/features/map";
import { errorMessage } from "@/shared/api";
import { PATHS } from "@/shared/config/paths";
import { useUnsavedChangesGuard } from "@/shared/hooks";
import { formatNumber } from "@/shared/lib/format";
import {
  Button,
  ButtonLink,
  Card,
  CardHeader,
  Field,
  FieldRow,
  Input,
  SaveBar,
  Skeleton,
  toast,
} from "@/shared/ui";
import { useSetStoreLocation } from "../api";

type Pos = { x: number; y: number } | null;

/**
 * Ponto da loja no mapa do andar dela: clique (ou arraste) no desenho,
 * use as setas com o mapa em foco, ou digite X e Y. As outras lojas do
 * andar aparecem apagadas, para não colar um pino no outro.
 */
export function LocationEditor({ store, readOnly }: { store: StoreDetail; readOnly: boolean }) {
  const floors = useFloors();
  const floor = floors.data?.find((f) => f.id === store.floor.id);
  const points = useMapPoints(store.floor.id);
  const others = useFloorPins(store.floor.id);
  const update = useSetStoreLocation();

  const saved: Pos =
    store.mapX !== null && store.mapY !== null ? { x: store.mapX, y: store.mapY } : null;
  const [pos, setPos] = useState<Pos>(saved);
  // Mudou no servidor (salvou aqui ou pelo editor do mapa): recomeça do salvo.
  const savedKey = `${store.mapX},${store.mapY}`;
  const [lastSavedKey, setLastSavedKey] = useState(savedKey);
  if (lastSavedKey !== savedKey) {
    setLastSavedKey(savedKey);
    setPos(saved);
  }
  const dirty = pos?.x !== saved?.x || pos?.y !== saved?.y;
  useUnsavedChangesGuard(dirty && !update.isPending);

  const svgRef = useRef<SVGSVGElement>(null);
  const toSvg = useSvgPoint(svgRef);
  const dragging = useRef(false);

  const placeAt = (clientX: number, clientY: number) => {
    const p = toSvg(clientX, clientY);
    if (p) setPos({ x: clamp(snap(p.x), 0, VIEW_W), y: clamp(snap(p.y), 0, VIEW_H) });
  };

  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (readOnly) return;
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    placeAt(e.clientX, e.clientY);
  };
  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    if (dragging.current) placeAt(e.clientX, e.clientY);
  };
  const onPointerUp = () => {
    dragging.current = false;
  };

  const onKeyDown = (e: KeyboardEvent<SVGSVGElement>) => {
    if (readOnly) return;
    const step = e.shiftKey ? 10 : 2;
    const d: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const delta = d[e.key];
    if (!delta) return;
    e.preventDefault();
    setPos((p) => {
      const base = p ?? { x: VIEW_W / 2, y: VIEW_H / 2 };
      return { x: clamp(base.x + delta[0], 0, VIEW_W), y: clamp(base.y + delta[1], 0, VIEW_H) };
    });
  };

  const save = () =>
    update.mutate(
      { id: store.id, body: { mapX: pos?.x ?? null, mapY: pos?.y ?? null } },
      {
        onSuccess: () => toast.success(pos ? "Posição no mapa salva." : "Loja tirada do mapa."),
        onError: (e) => toast.error(errorMessage(e)),
      },
    );

  const setCoord = (axis: "x" | "y", raw: string) => {
    const n = Number(raw);
    if (raw === "" || !Number.isFinite(n)) return;
    const max = axis === "x" ? VIEW_W : VIEW_H;
    setPos((p) => ({ x: VIEW_W / 2, y: VIEW_H / 2, ...p, [axis]: clamp(Math.round(n), 0, max) }));
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      noValidate
    >
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card padding="sm" className="overflow-hidden">
          {!floor ? (
            <Skeleton className="aspect-[360/470] w-full rounded-[1.4rem]" />
          ) : (
            <MapCanvas
              ref={svgRef}
              title={`Mapa do ${floor.label}`}
              tabIndex={readOnly ? undefined : 0}
              role="application"
              aria-roledescription="mapa"
              aria-label={`Mapa do ${floor.label}. ${readOnly ? "" : "Clique para posicionar a loja; com o mapa em foco, as setas movem o pino (Shift anda mais)."}`}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onKeyDown={onKeyDown}
              className={`mx-auto block max-h-[70vh] w-full touch-none rounded-[1.4rem] outline-none focus-visible:ring-4 focus-visible:ring-marca/40 ${readOnly ? "" : "cursor-crosshair"}`}
            >
              <g className="mapa-camada">
                {floor.layout.map((s, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: formas sem id; a ordem é a identidade
                  <MapShapeView key={i} shape={s} />
                ))}
                {(points.data ?? []).map((p) => (
                  <MapPointMark key={p.id} x={p.x} y={p.y} icon={p.icon} opacity={0.5} />
                ))}
                {others.pins
                  .filter((p) => p.store.id !== store.id)
                  .map((p) => (
                    <StorePinMark
                      key={p.store.id}
                      x={p.x}
                      y={p.y}
                      color={p.store.brandColor}
                      icon={p.store.icon}
                      name={p.store.name}
                      dimmed
                    />
                  ))}
                {pos && (
                  <StorePinMark
                    x={pos.x}
                    y={pos.y}
                    color={store.brandColor}
                    icon={store.icon}
                    name={store.name}
                    selected
                  />
                )}
              </g>
            </MapCanvas>
          )}
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader
              title={`No mapa do ${store.floor.label}`}
              description="O andar e o bloco se mudam na aba Dados."
            />
            <p aria-live="polite" className="mb-4 flex items-center gap-2 text-sm text-neutral-700">
              {pos ? (
                <>
                  <MousePointerClick className="size-4 text-neutral-400" aria-hidden />
                  Posição: x {formatNumber(pos.x)}, y {formatNumber(pos.y)}
                </>
              ) : (
                <>
                  <MapPinOff className="size-4 text-neutral-400" aria-hidden />
                  Ainda sem lugar no mapa. Clique no desenho para marcar.
                </>
              )}
            </p>
            <fieldset disabled={readOnly}>
              <legend className="sr-only">Coordenadas</legend>
              <FieldRow className="sm:grid-cols-2">
                <Field label={`X (0–${VIEW_W})`}>
                  <Input
                    type="number"
                    min={0}
                    max={VIEW_W}
                    value={pos?.x ?? ""}
                    onChange={(e) => setCoord("x", e.target.value)}
                  />
                </Field>
                <Field label={`Y (0–${VIEW_H})`}>
                  <Input
                    type="number"
                    min={0}
                    max={VIEW_H}
                    value={pos?.y ?? ""}
                    onChange={(e) => setCoord("y", e.target.value)}
                  />
                </Field>
              </FieldRow>
            </fieldset>
            <div className="mt-4 flex flex-wrap gap-2">
              {!readOnly && pos && (
                <Button variant="ghost" size="sm" icon={MapPinOff} onClick={() => setPos(null)}>
                  Tirar do mapa
                </Button>
              )}
              <ButtonLink
                to={PATHS.map(store.floor.id)}
                variant="secondary"
                size="sm"
                icon={ExternalLink}
              >
                Abrir editor do mapa
              </ButtonLink>
            </div>
          </Card>
          {others.error && (
            <p className="px-2 text-xs text-neutral-500">
              Não deu para carregar as outras lojas do andar: {errorMessage(others.error)}
            </p>
          )}
        </div>
      </div>
      {!readOnly && (
        <SaveBar
          dirty={dirty}
          saving={update.isPending}
          onReset={() => setPos(saved)}
          submitLabel="Salvar posição"
        />
      )}
    </form>
  );
}

import type { StoreDetail } from "@arp/contracts";
import { ExternalLink, MapPinOff, MousePointerClick } from "lucide-react";
import { type KeyboardEvent, type PointerEvent, useEffect, useRef, useState } from "react";
import {
  clamp,
  FloorPlanImage,
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
import {
  Button,
  ButtonLink,
  Card,
  CardHeader,
  Field,
  FieldRow,
  Input,
  Skeleton,
  Spinner,
  toast,
} from "@/shared/ui";
import { useSetStoreLocation } from "../api";

type Pos = { x: number; y: number } | null;

/**
 * Ponto da loja no mapa do andar dela: clique (ou arraste) no desenho ou
 * use as setas com o mapa em foco. Salva sozinho ao soltar, igual ao
 * editor do mapa, com "Desfazer" no aviso. X e Y ficam no "Ajuste fino".
 * As outras lojas do andar aparecem apagadas, para não colar um pino no outro.
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
  // Mudou no servidor (salvou aqui ou pelo editor do mapa): acompanha o salvo.
  const savedKey = `${store.mapX},${store.mapY}`;
  const [lastSavedKey, setLastSavedKey] = useState(savedKey);
  if (lastSavedKey !== savedKey) {
    setLastSavedKey(savedKey);
    setPos(saved);
  }

  const svgRef = useRef<SVGSVGElement>(null);
  const toSvg = useSvgPoint(svgRef);
  const dragging = useRef(false);
  const latest = useRef<Pos>(pos);
  latest.current = pos;
  const keyTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(keyTimer.current), []);

  /** Grava a posição (null = tira do mapa) e oferece voltar à anterior. */
  const save = (next: Pos, previous: Pos = saved) => {
    if (next?.x === previous?.x && next?.y === previous?.y) return;
    update.mutate(
      { id: store.id, body: { mapX: next?.x ?? null, mapY: next?.y ?? null } },
      {
        onSuccess: () =>
          toast.success(next ? "Posição salva." : "Loja tirada do mapa.", {
            action: {
              label: "Desfazer",
              onClick: () =>
                update.mutate(
                  { id: store.id, body: { mapX: previous?.x ?? null, mapY: previous?.y ?? null } },
                  {
                    onSuccess: () => toast.info("Posição anterior de volta."),
                    onError: (e) => toast.error(errorMessage(e)),
                  },
                ),
            },
          }),
        onError: (e) => {
          setPos(saved);
          toast.error(`Não deu para salvar a posição: ${errorMessage(e)}`);
        },
      },
    );
  };

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
    if (!dragging.current) return;
    dragging.current = false;
    save(latest.current);
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
    // Pelas setas, salva quando a pessoa para de apertar.
    clearTimeout(keyTimer.current);
    keyTimer.current = setTimeout(() => save(latest.current), 600);
  };

  const setCoord = (axis: "x" | "y", raw: string) => {
    const n = Number(raw);
    if (raw === "" || !Number.isFinite(n)) return;
    const max = axis === "x" ? VIEW_W : VIEW_H;
    setPos((p) => ({ x: VIEW_W / 2, y: VIEW_H / 2, ...p, [axis]: clamp(Math.round(n), 0, max) }));
  };

  return (
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
            aria-label={`Mapa do ${floor.label}. ${readOnly ? "" : "Clique para posicionar a loja; com o mapa em foco, as setas movem o pino (Shift anda mais). Salva sozinho."}`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onKeyDown={onKeyDown}
            className={`mx-auto block max-h-[70vh] w-full touch-none rounded-[1.4rem] outline-none focus-visible:ring-4 focus-visible:ring-marca/40 ${readOnly ? "" : "cursor-crosshair"}`}
          >
            {floor.backgroundImageUrl && (
              <FloorPlanImage url={floor.backgroundImageUrl} opacity={0.3} />
            )}
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
            description="O andar e o bloco se mudam na aba Dados (trocar o andar tira a loja do mapa)."
          />
          <p aria-live="polite" className="mb-4 flex items-center gap-2 text-sm text-neutral-700">
            {update.isPending ? (
              <>
                <Spinner className="size-4" />
                Salvando a posição…
              </>
            ) : pos ? (
              <>
                <MousePointerClick className="size-4 text-neutral-400" aria-hidden />
                {readOnly
                  ? "A loja está marcada no mapa."
                  : "No mapa. Clique ou arraste para mudar; salva sozinho."}
              </>
            ) : (
              <>
                <MapPinOff className="size-4 text-neutral-400" aria-hidden />
                Ainda sem lugar no mapa.{readOnly ? "" : " Clique no desenho para marcar."}
              </>
            )}
          </p>
          {!readOnly && (
            <details className="mb-4 rounded-2xl bg-neutral-900/[0.03] px-3 py-2">
              <summary className="cursor-pointer text-sm font-medium text-neutral-700">
                Ajuste fino
              </summary>
              <form
                className="mt-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  save(pos);
                }}
              >
                <FieldRow className="sm:grid-cols-2">
                  <Field label={`Horizontal (0–${VIEW_W})`}>
                    <Input
                      type="number"
                      min={0}
                      max={VIEW_W}
                      value={pos?.x ?? ""}
                      onChange={(e) => setCoord("x", e.target.value)}
                      onBlur={() => save(latest.current)}
                    />
                  </Field>
                  <Field label={`Vertical (0–${VIEW_H})`}>
                    <Input
                      type="number"
                      min={0}
                      max={VIEW_H}
                      value={pos?.y ?? ""}
                      onChange={(e) => setCoord("y", e.target.value)}
                      onBlur={() => save(latest.current)}
                    />
                  </Field>
                </FieldRow>
              </form>
            </details>
          )}
          <div className="flex flex-wrap gap-2">
            {!readOnly && pos && (
              <Button
                variant="ghost"
                size="sm"
                icon={MapPinOff}
                onClick={() => {
                  setPos(null);
                  save(null);
                }}
              >
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
  );
}

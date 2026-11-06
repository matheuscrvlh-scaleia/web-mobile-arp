import { Layers, MapPin, PencilRuler, RotateCcw, Save } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { useSetStoreLocation } from "@/features/stores";
import { errorMessage } from "@/shared/api";
import { useAuth } from "@/shared/auth";
import { useSearchParamOption, useUnsavedChangesGuard } from "@/shared/hooks";
import { plural } from "@/shared/lib/format";
import {
  Button,
  Card,
  confirmar,
  EmptyState,
  ErrorState,
  LoadingRegion,
  PageHeader,
  Skeleton,
  Tabs,
  toast,
} from "@/shared/ui";
import {
  useFloorPins,
  useFloors,
  useMapPoints,
  useSaveFloorLayout,
  useUpdateMapPoint,
} from "../api";
import { FloorElevator } from "../components/FloorElevator";
import { FloorFormModal } from "../components/FloorFormModal";
import { FloorsPanel } from "../components/FloorsPanel";
import { LayoutPanel } from "../components/LayoutPanel";
import { type EditorMode, MapEditorCanvas } from "../components/MapEditorCanvas";
import { NewMapPointModal } from "../components/MapPointForm";
import { PinsPanel } from "../components/PinsPanel";
import { useMapEditor } from "../components/useMapEditor";

const MODES = ["pinos", "desenho"] as const;

export function MapPage() {
  const { can } = useAuth();
  const canEditMap = can("map.manage");
  // O pino da loja é do mapa (PUT /stores/:id/location), não da edição da loja.
  const canMoveStores = canEditMap;
  const floors = useFloors();
  const [params, setParams] = useSearchParams();
  const [mode, setMode] = useSearchParamOption<EditorMode>("modo", MODES, "pinos");
  const [creatingFloor, setCreatingFloor] = useState(false);
  const [newPointAt, setNewPointAt] = useState<{ x: number; y: number } | null>(null);

  const list = floors.data ?? [];
  const requested = params.get("andar");
  // Sem andar na URL: o 1º andar (nível 0) ou o mais baixo.
  const floor = list.find((f) => f.id === requested) ?? list.find((f) => f.level === 0) ?? list[0];
  const floorId = floor?.id;

  const points = useMapPoints(floorId);
  const stores = useFloorPins(floorId);
  const moveStore = useSetStoreLocation();
  const movePoint = useUpdateMapPoint(floorId ?? "");
  const saveLayout = useSaveFloorLayout();

  const svgRef = useRef<SVGSVGElement>(null);
  const savedLayout = useMemo(() => floor?.layout ?? [], [floor?.layout]);

  const onMoveStore = useCallback(
    (id: string, pos: { x: number; y: number }) =>
      moveStore.mutate(
        { id, body: { mapX: pos.x, mapY: pos.y } },
        { onError: (e) => toast.error(`Não deu para mover a loja: ${errorMessage(e)}`) },
      ),
    [moveStore],
  );
  const onMovePoint = useCallback(
    (id: string, pos: { x: number; y: number }) =>
      movePoint.mutate(
        { id, body: pos },
        { onError: (e) => toast.error(`Não deu para mover o ponto: ${errorMessage(e)}`) },
      ),
    [movePoint],
  );

  const editor = useMapEditor({
    svgRef,
    floorId,
    savedLayout,
    onMoveStore,
    onMovePoint,
    onPlace: (placing, pos) => {
      if (placing.type === "store") {
        onMoveStore(placing.id, pos);
        editor.setSelection({ type: "store", id: placing.id });
      } else {
        setNewPointAt(pos);
      }
    },
  });
  const { allowLeave } = useUnsavedChangesGuard(editor.layoutDirty && !saveLayout.isPending);

  const selectFloor = async (id: string) => {
    if (id === floorId) return;
    if (
      editor.layoutDirty &&
      !(await confirmar({
        title: "Trocar de andar sem salvar?",
        description:
          "O desenho deste andar tem alterações não salvas. Se trocar agora, elas se perdem.",
        confirmLabel: "Trocar sem salvar",
        danger: true,
      }))
    )
      return;
    allowLeave();
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("andar", id);
        return next;
      },
      { replace: true },
    );
  };

  const save = () => {
    if (!floorId) return;
    saveLayout.mutate(
      { id: floorId, layout: editor.layout },
      {
        onSuccess: () => toast.success("Desenho do andar salvo. O app já mostra o novo mapa."),
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  };

  const header = (
    <PageHeader
      title="Mapa"
      description="O mapa por andar do app: desenho, pinos das lojas e pontos de referência."
    />
  );

  if (floors.error) {
    return (
      <>
        {header}
        <Card>
          <ErrorState error={floors.error} onRetry={() => void floors.refetch()} />
        </Card>
      </>
    );
  }
  if (floors.isLoading) {
    return (
      <>
        {header}
        <LoadingRegion className="lg:flex-row">
          <Skeleton className="aspect-[360/470] w-full max-w-2xl rounded-[1.75rem]" />
          <Skeleton className="h-96 w-full rounded-[1.75rem] lg:w-96" />
        </LoadingRegion>
      </>
    );
  }
  if (!floor) {
    return (
      <>
        {header}
        <Card>
          <EmptyState
            icon={Layers}
            title="Nenhum andar cadastrado"
            description="Crie o 1º andar para começar a desenhar o mapa."
            action={
              canEditMap && (
                <Button icon={Layers} onClick={() => setCreatingFloor(true)}>
                  Criar andar
                </Button>
              )
            }
          />
        </Card>
        <FloorFormModal open={creatingFloor} onClose={() => setCreatingFloor(false)} />
      </>
    );
  }

  return (
    <>
      {header}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card padding="sm" className="relative overflow-hidden">
            <div className="pointer-events-none absolute top-6 left-6 z-10">
              <p className="text-3xl font-bold tracking-tight text-neutral-900">{floor.label}</p>
              <p className="text-xs font-medium text-neutral-500">
                {plural(stores.total, "loja neste andar", "lojas neste andar")}
                {stores.isLoading && " · carregando pinos…"}
              </p>
            </div>
            <div className="absolute top-6 right-6 z-10">
              <FloorElevator floors={list} value={floorId} onChange={selectFloor} />
            </div>
            <MapEditorCanvas
              svgRef={svgRef}
              editor={editor}
              mode={mode}
              pins={stores.pins}
              points={points.data ?? []}
              floorLabel={floor.label}
              canMoveStores={canMoveStores}
              canEditMap={canEditMap}
            />
          </Card>
          {mode === "desenho" && canEditMap && (
            <div className="fume sticky bottom-3 z-20 flex flex-wrap items-center justify-end gap-2 rounded-full py-1.5 pr-1.5 pl-5">
              <span className="mr-auto text-sm text-[rgb(255_255_255/0.8)]">
                {editor.layoutDirty ? "Desenho com alterações não salvas" : "Desenho salvo"}
              </span>
              <button
                type="button"
                onClick={editor.resetLayout}
                disabled={!editor.layoutDirty || saveLayout.isPending}
                className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full px-4 text-sm text-[rgb(255_255_255/0.85)] transition hover:bg-[rgb(255_255_255/0.1)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <RotateCcw className="size-4" aria-hidden />
                Desfazer
              </button>
              <Button
                variant="brand"
                icon={Save}
                loading={saveLayout.isPending}
                disabled={!editor.layoutDirty}
                onClick={save}
              >
                Salvar desenho
              </Button>
            </div>
          )}
          {(stores.error || points.error) && (
            <Card padding="sm">
              <ErrorState
                compact
                title="Parte do mapa não carregou"
                error={stores.error ?? points.error}
                onRetry={() => {
                  stores.refetch();
                  void points.refetch();
                }}
              />
            </Card>
          )}
        </div>

        <aside aria-label="Edição do mapa" className="flex flex-col gap-4">
          <Tabs
            idBase="mapa"
            label="O que editar"
            value={mode}
            onChange={(m) => {
              editor.setSelection(null);
              editor.setPlacing(null);
              setMode(m);
            }}
            items={[
              { value: "pinos", label: "Lojas e pontos", icon: MapPin },
              { value: "desenho", label: "Desenho", icon: PencilRuler },
            ]}
            className="w-full"
          />
          <div role="tabpanel" id={`mapa-panel-${mode}`} aria-labelledby={`mapa-tab-${mode}`}>
            {mode === "pinos" ? (
              <PinsPanel
                editor={editor}
                pins={stores.pins}
                unplaced={stores.unplaced}
                points={points.data ?? []}
                canMoveStores={canMoveStores}
                canEditMap={canEditMap}
                onRemoveStore={(id) => {
                  moveStore.mutate(
                    { id, body: { mapX: null, mapY: null } },
                    {
                      onSuccess: () => toast.success("Loja tirada do mapa."),
                      onError: (e) => toast.error(errorMessage(e)),
                    },
                  );
                  editor.setSelection(null);
                }}
              />
            ) : (
              <LayoutPanel editor={editor} readOnly={!canEditMap} />
            )}
          </div>
          <FloorsPanel
            floors={list}
            currentId={floorId}
            canEdit={canEditMap}
            onSelect={selectFloor}
          />
        </aside>
      </div>

      <NewMapPointModal
        floorId={floor.id}
        position={newPointAt}
        onClose={() => setNewPointAt(null)}
      />
    </>
  );
}

import type { Floor, MapPoint, MapShape, StorePin } from "@arp/contracts";
import { ExternalLink, Layers, MapPinOff, MapPinPlus, Plus, TriangleAlert, X } from "lucide-react";
import { useState } from "react";
import { PATHS } from "@/shared/config/paths";
import { cn } from "@/shared/lib/cn";
import { normalize } from "@/shared/lib/text";
import {
  Button,
  ButtonLink,
  Card,
  CardHeader,
  CountPill,
  Field,
  IconButton,
  IconTile,
  SearchInput,
  Select,
} from "@/shared/ui";
import type { PlacedPin } from "../api";
import { MapPointEditor } from "./MapPointForm";
import type { MapEditor } from "./useMapEditor";

const ROW =
  "flex w-full cursor-pointer items-center gap-3 rounded-2xl px-2 py-2 text-left text-sm transition hover:bg-white/60";

/** Busca por palavras (em qualquer ordem) no nome, categoria e bloco da loja. */
function matches(store: StorePin, q: string): boolean {
  const words = normalize(q).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const text = normalize(`${store.name} ${store.category.name} ${store.block.name}`);
  return words.every((w) => text.includes(w));
}

/** Forma "Bloco" do desenho onde o pino caiu (para conferir com o bloco da loja). */
export function blockShapeAt(layout: MapShape[], x: number, y: number): MapShape | undefined {
  // A última desenhada fica por cima.
  return [...layout]
    .reverse()
    .find((s) => s.kind === "block" && x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h);
}

/** Painel do modo "Lojas e pontos": o item selecionado ou as listas do andar. */
export function PinsPanel({
  editor,
  pins,
  unplaced,
  points,
  floors,
  floorId,
  canMoveStores,
  canEditMap,
  onRemoveStore,
  onChangeFloor,
  onFixBlock,
}: {
  editor: MapEditor;
  pins: PlacedPin[];
  unplaced: StorePin[];
  points: MapPoint[];
  floors: Floor[];
  floorId: string;
  canMoveStores: boolean;
  canEditMap: boolean;
  onRemoveStore: (id: string) => void;
  /** Leva a loja para outro andar (sai do mapa deste e abre o outro para posicionar). */
  onChangeFloor: (storeId: string, floorId: string) => void;
  /** Muda o bloco do cadastro da loja para o bloco desenhado onde está o pino. */
  onFixBlock?: ((storeId: string, blockId: string, blockName: string) => void) | undefined;
}) {
  const { selection, placing } = editor;
  const [search, setSearch] = useState("");

  if (placing) {
    const store = placing.type === "store" ? unplaced.find((s) => s.id === placing.id) : null;
    return (
      <Card variant="dark">
        <p className="text-sm font-semibold">
          {store ? `Onde fica a ${store.name}?` : "Onde fica o novo ponto?"}
        </p>
        <p className="mt-1 text-sm text-neutral-600">
          Clique no lugar certo do mapa. Salva sozinho.
        </p>
        <Button
          variant="secondary"
          size="sm"
          icon={X}
          className="mt-4"
          onClick={() => editor.setPlacing(null)}
        >
          Cancelar
        </Button>
      </Card>
    );
  }

  if (selection?.type === "store") {
    const pin = pins.find((p) => p.store.id === selection.id);
    if (pin) {
      const shape = blockShapeAt(editor.layout, pin.x, pin.y);
      const wrongBlock = shape?.blockId && shape.blockId !== pin.store.block.id ? shape : null;
      return (
        <Card>
          <div className="mb-4 flex items-start gap-3">
            <IconTile icon={pin.store.icon} color={pin.store.brandColor} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{pin.store.name}</p>
              <p className="text-xs text-neutral-500">
                {pin.store.category.name} · {pin.store.block.name}
              </p>
            </div>
            <IconButton
              icon={X}
              label="Fechar"
              size="sm"
              onClick={() => editor.setSelection(null)}
            />
          </div>
          <p className="mb-4 text-xs text-neutral-500">
            {canMoveStores
              ? "Arraste o pino ou use as setas com o mapa em foco. Salva sozinho ao soltar."
              : "Você pode ver, mas não mover lojas."}
          </p>
          {wrongBlock && (
            <div className="mb-4 flex gap-2 rounded-2xl bg-amber-50 p-3 text-xs text-amber-900">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <div className="flex flex-col gap-2">
                <p>
                  O pino está no desenho do <strong>{wrongBlock.label || "outro bloco"}</strong>,
                  mas no cadastro a loja é do <strong>{pin.store.block.name}</strong>.
                </p>
                {onFixBlock && wrongBlock.blockId && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="w-fit"
                    onClick={() =>
                      onFixBlock(pin.store.id, wrongBlock.blockId as string, wrongBlock.label)
                    }
                  >
                    Mudar a loja para o {wrongBlock.label || "bloco do desenho"}
                  </Button>
                )}
              </div>
            </div>
          )}
          {canMoveStores && floors.length > 1 && (
            <Field
              label="Andar"
              hint="Ao trocar, a loja sai deste mapa e você posiciona no outro andar."
              className="mb-4"
            >
              <Select value={floorId} onChange={(e) => onChangeFloor(pin.store.id, e.target.value)}>
                {floors.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <div className="flex flex-wrap gap-2">
            <ButtonLink
              to={PATHS.store(pin.store.id)}
              variant="secondary"
              size="sm"
              icon={ExternalLink}
            >
              Abrir loja
            </ButtonLink>
            {canMoveStores && (
              <Button
                variant="ghost"
                size="sm"
                icon={MapPinOff}
                onClick={() => onRemoveStore(pin.store.id)}
              >
                Tirar do mapa
              </Button>
            )}
          </div>
        </Card>
      );
    }
  }

  if (selection?.type === "point") {
    const point = points.find((p) => p.id === selection.id);
    if (point) {
      return (
        <Card>
          <CardHeader
            title="Ponto de referência"
            description={canEditMap ? "Arraste no mapa para mover." : undefined}
            action={
              <IconButton
                icon={X}
                label="Fechar"
                size="sm"
                onClick={() => editor.setSelection(null)}
              />
            }
          />
          <MapPointEditor
            key={point.id}
            point={point}
            readOnly={!canEditMap}
            onDeleted={() => editor.setSelection(null)}
          />
        </Card>
      );
    }
  }

  const foundPins = pins.filter((p) => matches(p.store, search));
  const foundUnplaced = unplaced.filter((s) => matches(s, search));

  return (
    <div className="flex flex-col gap-4">
      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Buscar loja ou bloco neste andar"
        label="Buscar loja no mapa"
      />

      {!search && (
        <Card>
          <CardHeader
            title="Pontos de referência"
            description="Reciclagem, início do tour, estacionamento…"
            action={
              canEditMap && (
                <Button
                  size="sm"
                  variant="secondary"
                  icon={Plus}
                  onClick={() => editor.setPlacing({ type: "point" })}
                >
                  Novo
                </Button>
              )
            }
          />
          {points.length === 0 ? (
            <p className="text-sm text-neutral-500">Nenhum ponto neste andar.</p>
          ) : (
            <ul className="flex max-h-48 flex-col gap-0.5 overflow-y-auto">
              {points.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => editor.setSelection({ type: "point", id: p.id })}
                    className={ROW}
                  >
                    <IconTile icon={p.icon} size="sm" />
                    <span className="truncate">{p.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <Card>
        <CardHeader
          title="Lojas no mapa"
          description={pins.length > 0 ? "Clique para ver o pino no mapa." : undefined}
          action={
            <CountPill>{search ? `${foundPins.length}/${pins.length}` : pins.length}</CountPill>
          }
        />
        {foundPins.length === 0 ? (
          <p className="text-sm text-neutral-500">
            {search
              ? "Nenhuma loja no mapa com essa busca."
              : "Nenhuma loja posicionada neste andar."}
          </p>
        ) : (
          <ul className="flex max-h-72 flex-col gap-0.5 overflow-y-auto">
            {foundPins.map((p) => (
              <li key={p.store.id}>
                <button
                  type="button"
                  onClick={() => editor.setSelection({ type: "store", id: p.store.id })}
                  className={cn(ROW, p.store.status === "inactive" && "opacity-60")}
                >
                  <IconTile icon={p.store.icon} color={p.store.brandColor} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{p.store.name}</span>
                    <span className="block truncate text-xs text-neutral-500">
                      {p.store.block.name}
                    </span>
                  </span>
                  {p.store.status === "inactive" && (
                    <span className="text-xs text-neutral-500">inativa</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {unplaced.length > 0 && (
        <Card data-guia="sem-lugar" variant="green">
          <CardHeader
            title="Sem lugar no mapa"
            description="Estas lojas do andar ainda não aparecem no mapa do app."
            action={
              <CountPill active>
                {search ? `${foundUnplaced.length}/${unplaced.length}` : unplaced.length}
              </CountPill>
            }
          />
          {foundUnplaced.length === 0 ? (
            <p className="text-sm text-neutral-600">Nenhuma loja sem lugar com essa busca.</p>
          ) : (
            <ul className="-mr-2 flex max-h-[50vh] flex-col gap-1 overflow-y-auto pr-2">
              {foundUnplaced.map((s) => (
                <li key={s.id} className="flex items-center gap-2">
                  <IconTile icon={s.icon} color={s.brandColor} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{s.name}</span>
                    <span className="block truncate text-xs text-neutral-600">{s.block.name}</span>
                  </span>
                  {canMoveStores && (
                    <Button
                      size="sm"
                      icon={MapPinPlus}
                      onClick={() => editor.setPlacing({ type: "store", id: s.id })}
                    >
                      Pôr no mapa
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {!canMoveStores && (
        <p className="flex items-center gap-1.5 px-2 text-xs text-neutral-500">
          <Layers className="size-3.5" aria-hidden />
          Você pode ver o mapa, mas não mover as lojas.
        </p>
      )}
    </div>
  );
}

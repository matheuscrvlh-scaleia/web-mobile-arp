import type { MapPoint, StorePin } from "@arp/contracts";
import { ExternalLink, MapPinOff, MapPinPlus, Plus, X } from "lucide-react";
import { Link } from "react-router";
import { PATHS } from "@/shared/config/paths";
import { cn } from "@/shared/lib/cn";
import { Button, ButtonLink, Card, CardHeader, CountPill, IconButton, IconTile } from "@/shared/ui";
import type { PlacedPin } from "../api";
import { MapPointEditor } from "./MapPointForm";
import type { MapEditor } from "./useMapEditor";

const ROW =
  "flex w-full cursor-pointer items-center gap-3 rounded-2xl px-2 py-2 text-left text-sm transition hover:bg-white/60";

/** Painel do modo "Lojas e pontos": o item selecionado ou as listas do andar. */
export function PinsPanel({
  editor,
  pins,
  unplaced,
  points,
  canMoveStores,
  canEditMap,
  onRemoveStore,
}: {
  editor: MapEditor;
  pins: PlacedPin[];
  unplaced: StorePin[];
  points: MapPoint[];
  canMoveStores: boolean;
  canEditMap: boolean;
  onRemoveStore: (id: string) => void;
}) {
  const { selection, placing } = editor;

  if (placing) {
    const store = placing.type === "store" ? unplaced.find((s) => s.id === placing.id) : null;
    return (
      <Card variant="dark">
        <p className="text-sm font-semibold">
          {store ? `Onde fica a ${store.name}?` : "Onde fica o novo ponto?"}
        </p>
        <p className="mt-1 text-sm text-neutral-600">Clique no lugar certo do mapa.</p>
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

  return (
    <div className="flex flex-col gap-4">
      {unplaced.length > 0 && (
        <Card variant="green">
          <CardHeader
            title="Sem lugar no mapa"
            description="Estas lojas do andar ainda não aparecem no mapa do app."
            action={<CountPill active>{unplaced.length}</CountPill>}
          />
          <ul className="flex flex-col gap-1">
            {unplaced.map((s) => (
              <li key={s.id} className="flex items-center gap-2">
                <IconTile icon={s.icon} color={s.brandColor} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{s.name}</span>
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
        </Card>
      )}

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
          <ul className="flex flex-col gap-0.5">
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

      <Card>
        <CardHeader title="Lojas no mapa" action={<CountPill>{pins.length}</CountPill>} />
        {pins.length === 0 ? (
          <p className="text-sm text-neutral-500">Nenhuma loja posicionada neste andar.</p>
        ) : (
          <ul className="flex max-h-80 flex-col gap-0.5 overflow-y-auto">
            {pins.map((p) => (
              <li key={p.store.id}>
                <button
                  type="button"
                  onClick={() => editor.setSelection({ type: "store", id: p.store.id })}
                  className={cn(ROW, p.store.status === "inactive" && "opacity-60")}
                >
                  <IconTile icon={p.store.icon} color={p.store.brandColor} size="sm" />
                  <span className="min-w-0 flex-1 truncate">{p.store.name}</span>
                  {p.store.status === "inactive" && (
                    <span className="text-xs text-neutral-500">inativa</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-neutral-500">
          O andar de cada loja muda na{" "}
          <Link to={PATHS.stores} className="underline underline-offset-2 hover:text-neutral-900">
            página da loja
          </Link>
          .
        </p>
      </Card>
    </div>
  );
}

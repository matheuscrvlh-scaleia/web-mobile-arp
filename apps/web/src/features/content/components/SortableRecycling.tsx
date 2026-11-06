import type { RecyclingItem } from "@arp/contracts";
import { ArrowDown, ArrowUp, Award, GripVertical, Pencil, Trash2 } from "lucide-react";
import { useId, useMemo } from "react";
import { useSortable } from "@/features/highlights";
import { cn } from "@/shared/lib/cn";
import { ActionMenu, IconButton, IconTile, StatusBadge, toast } from "@/shared/ui";
import { useReorderRecyclingItems } from "../api";

/**
 * Itens do Sustentarp na ordem do app. Quem edita arrasta (mouse), usa o
 * teclado na alça (Espaço pega, setas movem, Espaço solta) ou as setas.
 * Salva a ordem inteira a cada soltura. Clicar no item abre para editar.
 */
export function SortableRecycling({
  items,
  canEdit,
  onEdit,
  onDelete,
}: {
  items: RecyclingItem[];
  canEdit: boolean;
  onEdit: (item: RecyclingItem) => void;
  onDelete: (item: RecyclingItem) => void;
}) {
  const instructionsId = useId();
  const reorder = useReorderRecyclingItems();
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const ids = useMemo(() => items.map((i) => i.id), [items]);
  const sortable = useSortable({
    ids,
    enabled: canEdit,
    labelOf: (id) => byId.get(id)?.name ?? "Item",
    // Desfazer devolve a ordem de antes (ids = a ordem que estava na tela).
    onCommit: (next) => {
      const before = ids;
      reorder.mutateAsync(next).then(
        () =>
          toast.success("Ordem do Sustentarp salva.", {
            action: {
              label: "Desfazer",
              onClick: () =>
                reorder.mutateAsync(before).then(
                  () => toast.success("Ordem anterior de volta."),
                  (e) => toast.fromError(e),
                ),
            },
          }),
        (e) => toast.fromError(e),
      );
    },
  });

  return (
    <>
      <p id={instructionsId} className="sr-only">
        Para mover, pressione Espaço na alça, use as setas e pressione Espaço de novo para soltar.
        Esc cancela.
      </p>
      <p aria-live="assertive" className="sr-only">
        {sortable.message}
      </p>
      <ol aria-label="Ordem no app" className="flex flex-col gap-1">
        {sortable.order.map((id, index) => {
          const item = byId.get(id);
          if (!item) return null;
          const active = sortable.grabbed === id || sortable.dragging === id;
          return (
            <li
              key={id}
              {...sortable.itemProps(id)}
              className={cn(
                "flex items-center gap-2 rounded-[1.4rem] border border-transparent p-2 transition",
                active ? "border-neutral-900/30 bg-white shadow-xl" : "hover:bg-white/60",
              )}
            >
              {canEdit && (
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    ref={sortable.handleRef(id)}
                    aria-label={`Mover ${item.name}, posição ${index + 1} de ${sortable.order.length}`}
                    aria-describedby={instructionsId}
                    aria-pressed={sortable.grabbed === id}
                    onKeyDown={(e) => sortable.onHandleKeyDown(e, id)}
                    className="grid size-11 cursor-grab place-items-center rounded-full text-neutral-400 hover:bg-neutral-900/[0.06] hover:text-neutral-900 active:cursor-grabbing aria-pressed:bg-neutral-900 aria-pressed:text-white sm:size-8"
                  >
                    <GripVertical className="size-4" aria-hidden />
                  </button>
                  <IconButton
                    icon={ArrowUp}
                    size="sm"
                    label={`Subir ${item.name}`}
                    disabled={index === 0 || reorder.isPending}
                    onClick={() => sortable.nudge(id, -1)}
                    className="hidden sm:inline-grid"
                  />
                  <IconButton
                    icon={ArrowDown}
                    size="sm"
                    label={`Descer ${item.name}`}
                    disabled={index === sortable.order.length - 1 || reorder.isPending}
                    onClick={() => sortable.nudge(id, 1)}
                    className="hidden sm:inline-grid"
                  />
                </div>
              )}
              <button
                type="button"
                draggable={false}
                disabled={!canEdit}
                onClick={() => onEdit(item)}
                className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-2xl p-1 text-left disabled:cursor-default"
              >
                <IconTile icon={item.icon} size="sm" color="#2f7d3d" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium text-neutral-900">{item.name}</span>
                  <span className="line-clamp-1 text-xs text-neutral-500">
                    {item.accepts || "Sem descrição do que aceita"}
                  </span>
                </span>
                <span className="hidden shrink-0 items-center gap-1.5 sm:flex">
                  {item.givesSeal && (
                    <StatusBadge tone="brand" icon={Award}>
                      Vale selo
                    </StatusBadge>
                  )}
                  <StatusBadge tone={item.active ? "success" : "neutral"}>
                    {item.active ? "Visível" : "Oculto"}
                  </StatusBadge>
                </span>
              </button>
              {canEdit && (
                <ActionMenu
                  size="sm"
                  ariaLabel={`Mais ações de ${item.name}`}
                  items={[
                    { label: "Editar", icon: Pencil, onSelect: () => onEdit(item) },
                    {
                      label: "Excluir",
                      icon: Trash2,
                      danger: true,
                      onSelect: () => onDelete(item),
                    },
                  ]}
                />
              )}
            </li>
          );
        })}
      </ol>
    </>
  );
}

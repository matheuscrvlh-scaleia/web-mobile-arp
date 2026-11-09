import { ArrowDown, ArrowUp, GripVertical, Pencil, Trash2 } from "lucide-react";
import { type ReactNode, useId, useMemo } from "react";
import { Link } from "react-router";
// atalho: o hook de arrastar mora em Destaques; mover para shared/hooks quando outro usar.
import { useSortable } from "@/features/highlights/lib/useSortable";
import { cn } from "@/shared/lib/cn";
import { plural } from "@/shared/lib/format";
import { ActionMenu, IconButton } from "@/shared/ui";

interface Item {
  id: string;
  name: string;
  storesCount: number;
}

/**
 * Lista de um cadastro (categorias de um tipo, blocos) na ordem do app.
 * Quem pode editar arrasta pela alça (ou Espaço + setas), ou usa os
 * botões subir/descer (no celular só eles: arrastar não funciona com o
 * toque); cada soltura grava a ordem inteira. O número de
 * lojas leva à lista de lojas já filtrada. Editar e excluir ficam no "⋯".
 */
export function SortableCatalogList<T extends Item>({
  items,
  label,
  canEdit,
  leading,
  storesHref,
  onReorder,
  onEdit,
  onDelete,
}: {
  items: T[];
  /** Nome da lista para leitores de tela (ex.: "Ordem das categorias de Lojas"). */
  label: string;
  canEdit: boolean;
  leading: (item: T) => ReactNode;
  storesHref: (item: T) => string;
  onReorder: (ids: string[]) => void;
  onEdit: (item: T) => void;
  onDelete: (item: T) => void;
}) {
  const instructionsId = useId();
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const ids = useMemo(() => items.map((i) => i.id), [items]);
  const sortable = useSortable({
    ids,
    enabled: canEdit,
    labelOf: (id) => byId.get(id)?.name ?? "Item",
    onCommit: onReorder,
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
      <ol data-guia="tabela" aria-label={label} className="flex flex-col">
        {sortable.order.map((id, index) => {
          const item = byId.get(id);
          if (!item) return null;
          const active = sortable.grabbed === id || sortable.dragging === id;
          return (
            <li
              key={id}
              {...sortable.itemProps(id)}
              className={cn(
                "flex items-center gap-2 rounded-2xl border border-transparent px-1 py-1.5 transition sm:gap-3",
                active
                  ? "border-neutral-900/30 bg-white shadow-xl ring-4 ring-marca/30"
                  : "hover:bg-white/60",
              )}
            >
              {canEdit && (
                <div className="flex shrink-0 items-center">
                  <button
                    type="button"
                    ref={sortable.handleRef(id)}
                    aria-label={`Mover ${item.name}, posição ${index + 1} de ${sortable.order.length}`}
                    aria-describedby={instructionsId}
                    aria-pressed={sortable.grabbed === id}
                    onKeyDown={(e) => sortable.onHandleKeyDown(e, id)}
                    className="hidden size-9 cursor-grab place-items-center rounded-full text-neutral-400 md:grid hover:bg-neutral-900/[0.06] hover:text-neutral-900 active:cursor-grabbing aria-pressed:bg-neutral-900 aria-pressed:text-white"
                  >
                    <GripVertical className="size-4" aria-hidden />
                  </button>
                  <IconButton
                    icon={ArrowUp}
                    size="sm"
                    label={`Subir ${item.name}`}
                    disabled={index === 0}
                    onClick={() => sortable.nudge(id, -1)}
                    className="pointer-coarse:size-11"
                  />
                  <IconButton
                    icon={ArrowDown}
                    size="sm"
                    label={`Descer ${item.name}`}
                    disabled={index === sortable.order.length - 1}
                    onClick={() => sortable.nudge(id, 1)}
                    className="pointer-coarse:size-11"
                  />
                </div>
              )}
              {leading(item)}
              {/* No celular, a contagem vai para baixo do nome (as setas ocupam a frente). */}
              <div className="flex min-w-0 flex-1 flex-col items-start sm:flex-row sm:items-center">
                {canEdit ? (
                  <button
                    type="button"
                    onClick={() => onEdit(item)}
                    className="w-full min-w-0 cursor-pointer truncate text-left text-sm font-medium hover:underline sm:flex-1"
                  >
                    {item.name}
                  </button>
                ) : (
                  <span className="w-full min-w-0 truncate text-sm font-medium sm:flex-1">
                    {item.name}
                  </span>
                )}
                <Link
                  to={storesHref(item)}
                  className="-ml-2.5 shrink-0 rounded-full px-2.5 py-0.5 text-xs text-neutral-600 tabular-nums hover:bg-neutral-900/[0.06] hover:text-neutral-900 sm:ml-0 sm:py-1"
                  title="Ver estas lojas"
                >
                  {item.storesCount === 0
                    ? "nenhuma loja"
                    : plural(item.storesCount, "loja", "lojas")}
                </Link>
              </div>
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
                      hint:
                        item.storesCount > 0
                          ? `Antes, escolha para onde vão as ${plural(item.storesCount, "loja", "lojas")}`
                          : undefined,
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

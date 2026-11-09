import type { Highlight } from "@arp/contracts";
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import { useId, useMemo } from "react";
import { cn } from "@/shared/lib/cn";
import { IconButton, toast } from "@/shared/ui";
import { useReorderHighlights } from "../api";
import { useSortable } from "../lib/useSortable";
import { HighlightItem } from "./HighlightItem";

/**
 * O carrossel na ordem do app (só os não arquivados: arquivado não tem posição). Quem pode editar arrasta (mouse), usa o
 * teclado na alça (Espaço pega, setas movem, Espaço solta, Esc cancela) ou
 * os botões subir/descer. Salva a ordem inteira a cada soltura.
 */
export function SortableHighlights({
  highlights,
  canReorder,
}: {
  highlights: Highlight[];
  canReorder: boolean;
}) {
  const instructionsId = useId();
  const reorder = useReorderHighlights();
  const byId = useMemo(() => new Map(highlights.map((h) => [h.id, h])), [highlights]);
  const ids = useMemo(() => highlights.map((h) => h.id), [highlights]);
  const sortable = useSortable({
    ids,
    enabled: canReorder,
    labelOf: (id) => byId.get(id)?.title ?? "Destaque",
    // Desfazer devolve a ordem de antes (ids = a ordem que estava na tela).
    onCommit: (next) => {
      const before = ids;
      reorder.mutateAsync(next).then(
        () =>
          toast.success("Ordem do carrossel salva.", {
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
      <ol data-guia="tabela" aria-label="Ordem do carrossel" className="flex flex-col gap-2">
        {sortable.order.map((id, index) => {
          const h = byId.get(id);
          if (!h) return null;
          const active = sortable.grabbed === id || sortable.dragging === id;
          return (
            <li
              key={id}
              {...sortable.itemProps(id)}
              className={cn(
                "flex items-center gap-3 rounded-[1.4rem] border border-transparent p-3 transition",
                active
                  ? "border-neutral-900/30 bg-white shadow-xl ring-4 ring-marca/30"
                  : "hover:bg-white/50",
                h.status !== "published" && !active && "[&_img]:opacity-60",
              )}
            >
              {canReorder && (
                <div className="flex shrink-0 flex-col items-center gap-0.5">
                  <IconButton
                    icon={ArrowUp}
                    size="sm"
                    label={`Subir ${h.title}`}
                    disabled={index === 0 || reorder.isPending}
                    onClick={() => sortable.nudge(id, -1)}
                    className="hidden sm:inline-grid"
                  />
                  <button
                    type="button"
                    ref={sortable.handleRef(id)}
                    aria-label={`Mover ${h.title}, posição ${index + 1} de ${sortable.order.length}`}
                    aria-describedby={instructionsId}
                    aria-pressed={sortable.grabbed === id}
                    onKeyDown={(e) => sortable.onHandleKeyDown(e, id)}
                    className="grid size-8 cursor-grab place-items-center rounded-full text-neutral-400 hover:bg-neutral-900/[0.06] hover:text-neutral-900 active:cursor-grabbing aria-pressed:bg-neutral-900 aria-pressed:text-white"
                  >
                    <GripVertical className="size-4" aria-hidden />
                  </button>
                  <IconButton
                    icon={ArrowDown}
                    size="sm"
                    label={`Descer ${h.title}`}
                    disabled={index === sortable.order.length - 1 || reorder.isPending}
                    onClick={() => sortable.nudge(id, 1)}
                    className="hidden sm:inline-grid"
                  />
                </div>
              )}
              <HighlightItem
                highlight={h}
                canManage={canReorder}
                lead={
                  <span
                    aria-hidden
                    className="grid size-7 shrink-0 place-items-center rounded-full bg-neutral-900 text-xs font-semibold text-white tabular-nums"
                  >
                    {index + 1}
                  </span>
                }
              />
            </li>
          );
        })}
      </ol>
    </>
  );
}

import type { Floor } from "@arp/contracts";
import { Layers, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { plural } from "@/shared/lib/format";
import { ActionMenu, Button, Card, CardHeader, ConfirmDialog, toast } from "@/shared/ui";
import { useDeleteFloor } from "../api";
import { FloorFormModal } from "./FloorFormModal";

/** Cadastro de andares (criar, renomear, excluir andar sem lojas), com ⋯ por linha. */
export function FloorsPanel({
  floors,
  currentId,
  canEdit,
  onSelect,
}: {
  floors: Floor[];
  currentId: string | undefined;
  canEdit: boolean;
  onSelect: (id: string) => void;
}) {
  const [editing, setEditing] = useState<Floor | "new" | null>(null);
  const [deleting, setDeleting] = useState<Floor | null>(null);
  const remove = useDeleteFloor();
  const ordered = [...floors].reverse();

  return (
    <Card>
      <CardHeader
        title="Andares"
        icon={Layers}
        action={
          canEdit && (
            <Button size="sm" variant="secondary" icon={Plus} onClick={() => setEditing("new")}>
              Novo andar
            </Button>
          )
        }
      />
      <ul className="flex flex-col gap-0.5">
        {ordered.map((f) => (
          <li key={f.id} className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onSelect(f.id)}
              aria-current={f.id === currentId ? "true" : undefined}
              className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-2xl px-2 py-2 text-left text-sm transition hover:bg-white/60 aria-[current=true]:bg-neutral-900/[0.06]"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-neutral-900 text-xs font-bold text-white">
                {f.shortLabel}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{f.label}</span>
                <span className="block text-xs text-neutral-500">
                  Nível {f.level} · {plural(f.storesCount, "loja", "lojas")}
                </span>
              </span>
            </button>
            {canEdit && (
              <ActionMenu
                size="sm"
                ariaLabel={`Mais ações de ${f.label}`}
                items={[
                  { label: "Editar", icon: Pencil, onSelect: () => setEditing(f) },
                  {
                    label: "Excluir andar",
                    icon: Trash2,
                    danger: true,
                    disabled: f.storesCount > 0,
                    hint:
                      f.storesCount > 0
                        ? `Tem ${plural(f.storesCount, "loja", "lojas")}: mude-as de andar antes.`
                        : undefined,
                    onSelect: () => setDeleting(f),
                  },
                ]}
              />
            )}
          </li>
        ))}
      </ul>

      <FloorFormModal
        open={editing !== null}
        floor={editing === "new" || editing === null ? undefined : editing}
        onClose={() => setEditing(null)}
      />
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => {
          setDeleting(null);
          remove.reset();
        }}
        danger
        title={`Excluir ${deleting?.label ?? "andar"}?`}
        description="O desenho e os pontos de referência deste andar também saem do app."
        confirmLabel="Excluir andar"
        loading={remove.isPending}
        error={remove.error}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting.id, {
            onSuccess: () => {
              toast.success("Andar excluído.");
              setDeleting(null);
            },
          })
        }
      />
    </Card>
  );
}

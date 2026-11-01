import type { Floor } from "@arp/contracts";
import { Layers, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { plural } from "@/shared/lib/format";
import { Button, Card, CardHeader, ConfirmDialog, IconButton, toast } from "@/shared/ui";
import { useDeleteFloor } from "../api";
import { FloorFormModal } from "./FloorFormModal";

/** Cadastro de andares (criar, renomear, apagar andar sem lojas). */
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
              <>
                <IconButton
                  icon={Pencil}
                  label={`Editar ${f.label}`}
                  size="sm"
                  onClick={() => setEditing(f)}
                />
                <IconButton
                  icon={Trash2}
                  label={
                    f.storesCount > 0
                      ? `${f.label} tem lojas: mude-as de andar antes`
                      : `Apagar ${f.label}`
                  }
                  size="sm"
                  variant="danger"
                  disabled={f.storesCount > 0}
                  onClick={() => setDeleting(f)}
                />
              </>
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
        title={`Apagar ${deleting?.label ?? "andar"}?`}
        description="O desenho e os pontos de referência deste andar também saem do app."
        confirmLabel="Apagar andar"
        loading={remove.isPending}
        error={remove.error}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting.id, {
            onSuccess: () => {
              toast.success("Andar apagado.");
              setDeleting(null);
            },
          })
        }
      />
    </Card>
  );
}

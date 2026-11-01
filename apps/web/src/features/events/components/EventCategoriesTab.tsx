import type { EventCategory } from "@arp/contracts";
import { Pencil, Plus, Tags, Trash2 } from "lucide-react";
import { useState } from "react";
import { formatNumber } from "@/shared/lib/format";
import {
  Button,
  Card,
  CardHeader,
  type Column,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  IconButton,
  IconTile,
  Table,
  toast,
} from "@/shared/ui";
import { useDeleteEventCategory, useEventCategories } from "../api";
import { EventCategoryFormModal } from "./EventCategoryFormModal";

/** Aba "Categorias": cadastro das categorias da agenda. */
export function EventCategoriesTab({ canEdit }: { canEdit: boolean }) {
  const categories = useEventCategories();
  const remove = useDeleteEventCategory();
  const [editing, setEditing] = useState<EventCategory | "new" | null>(null);
  const [deleting, setDeleting] = useState<EventCategory | null>(null);

  const columns: Column<EventCategory>[] = [
    {
      key: "name",
      header: "Categoria",
      cell: (c) => (
        <span className="flex items-center gap-3">
          <IconTile icon={c.icon} size="sm" color="#2f7d3d" />
          <span className="font-medium">{c.name}</span>
        </span>
      ),
    },
    { key: "order", header: "Ordem", numeric: true, cell: (c) => c.sortOrder },
    { key: "events", header: "Eventos", numeric: true, cell: (c) => formatNumber(c.eventsCount) },
    ...(canEdit
      ? [
          {
            key: "actions",
            header: <span className="sr-only">Ações</span>,
            numeric: true,
            cell: (c: EventCategory) => (
              <span className="inline-flex gap-1">
                <IconButton
                  icon={Pencil}
                  size="sm"
                  label={`Editar ${c.name}`}
                  onClick={() => setEditing(c)}
                />
                <IconButton
                  icon={Trash2}
                  size="sm"
                  variant="danger"
                  label={
                    c.eventsCount > 0
                      ? `${c.name} tem eventos: mude-os de categoria antes`
                      : `Apagar ${c.name}`
                  }
                  disabled={c.eventsCount > 0}
                  onClick={() => setDeleting(c)}
                />
              </span>
            ),
          },
        ]
      : []),
  ];

  const rows = categories.data
    ?.slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "pt-BR"));

  return (
    <Card>
      <CardHeader
        title="Categorias de evento"
        description="Aparecem como filtro na agenda do app."
        action={
          canEdit && (
            <Button size="sm" variant="secondary" icon={Plus} onClick={() => setEditing("new")}>
              Nova
            </Button>
          )
        }
      />
      {categories.error ? (
        <ErrorState error={categories.error} onRetry={() => void categories.refetch()} />
      ) : (
        <Table
          caption="Categorias de evento"
          columns={columns}
          rows={rows}
          rowKey={(c) => c.id}
          loading={categories.isLoading}
          skeletonRows={4}
          empty={<EmptyState compact icon={Tags} title="Nenhuma categoria ainda" />}
        />
      )}

      <EventCategoryFormModal
        open={editing !== null}
        category={editing && editing !== "new" ? editing : undefined}
        onClose={() => setEditing(null)}
      />
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => {
          setDeleting(null);
          remove.reset();
        }}
        danger
        title={`Apagar a categoria ${deleting?.name ?? ""}?`}
        description="Ela some dos filtros da agenda do app."
        confirmLabel="Apagar"
        loading={remove.isPending}
        error={remove.error}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting.id, {
            onSuccess: () => {
              toast.success("Categoria apagada.");
              setDeleting(null);
            },
          })
        }
      />
    </Card>
  );
}

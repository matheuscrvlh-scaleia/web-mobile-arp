import type { Event, EventStatus } from "@arp/contracts";
import {
  Archive,
  ArchiveRestore,
  CalendarClock,
  CircleOff,
  Copy,
  type LucideIcon,
  Pause,
  Play,
  Radio,
  Trash2,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { useNavigate } from "react-router";
import { errorMessage } from "@/shared/api";
import { PATHS } from "@/shared/config/paths";
import { duplicateHref } from "@/shared/hooks";
import { plural } from "@/shared/lib/format";
import { type ActionMenuItems, ConfirmDialog, toast } from "@/shared/ui";
import { useArchiveEvent, useDeleteEvent, useUpdateEvent } from "../api";
import { PostponeEventDialog } from "./PostponeEventDialog";

/** Ação principal do status atual (botão do cabeçalho e item do menu da linha). */
export interface PrimaryAction {
  label: string;
  icon: LucideIcon;
  run: () => void;
}

const STATUS_DONE: Record<EventStatus, string> = {
  draft: "voltou para rascunho",
  published: "está no app",
  paused: "pausado: saiu do app",
  cancelled: "cancelado",
};

/**
 * Ciclo de vida do evento num lugar só (cabeçalho do detalhe e "⋯" da
 * lista). Reversível (publicar, pausar, retomar, arquivar) aplica na hora com
 * "Desfazer"; cancelar e excluir confirmam antes.
 */
export function useEventActions(event: Event, { onDeleted }: { onDeleted?: () => void } = {}) {
  const navigate = useNavigate();
  const update = useUpdateEvent(event.id);
  const archive = useArchiveEvent();
  const remove = useDeleteEvent();
  const [dialog, setDialog] = useState<"cancel" | "delete" | "postpone" | null>(null);
  const busy = update.isPending || archive.isPending || remove.isPending;
  const archived = Boolean(event.archivedAt);

  const fail = (e: unknown) => toast.error(errorMessage(e));
  const undone = () => toast.success(`“${event.title}” voltou como estava.`);

  // mutateAsync (e não callbacks do mutate): arquivar tira a linha da lista e
  // o retorno do mutate de um componente desmontado não roda.
  const setStatus = (status: EventStatus, undoTo: EventStatus) =>
    update.mutateAsync({ status }).then(
      () =>
        toast.success(`“${event.title}” ${STATUS_DONE[status]}.`, {
          action: {
            label: "Desfazer",
            onClick: () => update.mutateAsync({ status: undoTo }).then(undone, fail),
          },
        }),
      fail,
    );

  /**
   * Arquivar um publicado o pausa (sai do app). O Desfazer imediato devolve o
   * estado anterior de verdade: desarquiva e publica de novo. Desarquivar
   * depois (botão) não volta direto ao app.
   */
  const setArchived = (value: boolean) => {
    const wasPublished = value && event.status === "published";
    archive.mutateAsync({ id: event.id, archived: value }).then(
      () =>
        toast.success(
          value
            ? `“${event.title}” arquivado${wasPublished ? ": saiu do app" : ""}.`
            : `“${event.title}” desarquivado.`,
          {
            action: {
              label: "Desfazer",
              onClick: () =>
                archive
                  .mutateAsync({ id: event.id, archived: !value })
                  .then(() =>
                    wasPublished ? update.mutateAsync({ status: "published" }) : undefined,
                  )
                  .then(undone, fail),
            },
          },
        ),
      fail,
    );
  };

  const primary: PrimaryAction | null = archived
    ? { label: "Desarquivar", icon: ArchiveRestore, run: () => setArchived(false) }
    : event.status === "draft"
      ? { label: "Publicar", icon: Radio, run: () => setStatus("published", "draft") }
      : event.status === "published"
        ? { label: "Pausar", icon: Pause, run: () => setStatus("paused", "published") }
        : event.status === "paused"
          ? { label: "Retomar", icon: Play, run: () => setStatus("published", "paused") }
          : {
              label: "Publicar de novo",
              icon: Radio,
              run: () => setStatus("published", "cancelled"),
            };

  const interested = event.interestsCount;
  const menu: ActionMenuItems = [
    !archived && {
      label: "Adiar (nova data)",
      icon: CalendarClock,
      onSelect: () => setDialog("postpone"),
    },
    !archived &&
      (event.status === "published" || event.status === "paused") && {
        label: "Cancelar evento",
        icon: CircleOff,
        onSelect: () => setDialog("cancel"),
      },
    {
      label: "Duplicar",
      icon: Copy,
      onSelect: () => navigate(duplicateHref(PATHS.eventNew, event.id)),
    },
    !archived && { label: "Arquivar", icon: Archive, onSelect: () => setArchived(true) },
    {
      label: "Excluir",
      icon: Trash2,
      danger: true,
      disabled: interested > 0,
      hint:
        interested > 0
          ? `${plural(interested, "pessoa marcou", "pessoas marcaram")} interesse: arquive em vez de excluir`
          : undefined,
      onSelect: () => setDialog("delete"),
    },
  ];

  const close = () => {
    setDialog(null);
    update.reset();
    remove.reset();
  };

  const dialogs: ReactNode = (
    <>
      <ConfirmDialog
        open={dialog === "cancel"}
        onClose={close}
        danger
        title={`Cancelar “${event.title}”?`}
        description={
          interested > 0
            ? `O evento continua no app marcado como cancelado. ${plural(interested, "pessoa marcou", "pessoas marcaram")} interesse e verá o aviso ao abrir o app (ninguém recebe push sozinho).`
            : "O evento continua no app marcado como cancelado. Dá para publicar de novo depois."
        }
        confirmLabel="Cancelar evento"
        cancelLabel="Manter evento"
        loading={update.isPending}
        error={update.error}
        onConfirm={() =>
          update.mutate(
            { status: "cancelled" },
            {
              onSuccess: () => {
                close();
                toast.success(`“${event.title}” cancelado.`, {
                  action: {
                    label: "Avisar por push",
                    onClick: () =>
                      navigate(`${PATHS.notificationNew}?evento=${event.id}&motivo=cancelado`),
                  },
                });
              },
            },
          )
        }
      />
      <ConfirmDialog
        open={dialog === "delete"}
        onClose={close}
        danger
        title={`Excluir “${event.title}”?`}
        description="O evento some do painel e do app de vez. Não dá para desfazer."
        confirmLabel="Excluir evento"
        loading={remove.isPending}
        error={remove.error}
        onConfirm={() =>
          remove.mutate(event.id, {
            onSuccess: () => {
              close();
              toast.success(`“${event.title}” excluído.`);
              onDeleted?.();
            },
          })
        }
      />
      <PostponeEventDialog event={dialog === "postpone" ? event : null} onClose={close} />
    </>
  );

  return { primary, menu, dialogs, busy };
}

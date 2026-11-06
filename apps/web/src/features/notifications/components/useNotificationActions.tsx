import type { PushNotification } from "@arp/contracts";
import { CalendarX, Copy, type LucideIcon, Pencil, Trash2 } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useNavigate } from "react-router";
import { errorMessage } from "@/shared/api";
import { PATHS } from "@/shared/config/paths";
import { duplicateHref } from "@/shared/hooks";
import { type ActionMenuItems, ConfirmDialog, toast } from "@/shared/ui";
import { useDeleteNotification, useNotificationToDraft } from "../api";
import { CancelNotificationDialog } from "./CancelNotificationDialog";

export interface PrimaryAction {
  label: string;
  icon: LucideIcon;
  run: () => void;
  danger?: boolean;
}

/**
 * Ações de uma notificação conforme a situação (detalhe e "⋯" da lista):
 * agendada → cancelar; cancelada → voltar para rascunho; enviada → usar como
 * base; rascunho e cancelada → excluir.
 */
export function useNotificationActions(
  n: PushNotification,
  { onDeleted }: { onDeleted?: () => void } = {},
) {
  const navigate = useNavigate();
  const toDraft = useNotificationToDraft();
  const remove = useDeleteNotification();
  const [dialog, setDialog] = useState<"cancel" | "delete" | null>(null);
  const copy = () => navigate(duplicateHref(PATHS.notificationNew, n.id));

  const primary: PrimaryAction | null =
    n.status === "scheduled"
      ? {
          label: "Cancelar agendamento",
          icon: CalendarX,
          run: () => setDialog("cancel"),
          danger: true,
        }
      : n.status === "cancelled"
        ? {
            label: "Voltar para rascunho",
            icon: Pencil,
            run: () =>
              toDraft.mutate(n.id, {
                onSuccess: () => {
                  toast.success("Voltou para rascunho: ajuste e agende de novo.");
                  navigate(PATHS.notification(n.id));
                },
                onError: (e) => toast.error(errorMessage(e)),
              }),
          }
        : n.status === "sent"
          ? { label: "Usar como base", icon: Copy, run: copy }
          : null;

  const deletable = n.status === "draft" || n.status === "cancelled";
  const menu: ActionMenuItems = [
    n.status !== "sent" && { label: "Duplicar", icon: Copy, onSelect: copy },
    {
      label: "Excluir",
      icon: Trash2,
      danger: true,
      disabled: !deletable,
      hint:
        n.status === "sent"
          ? "Enviada fica no histórico"
          : n.status === "scheduled"
            ? "Cancele o agendamento antes"
            : undefined,
      onSelect: () => setDialog("delete"),
    },
  ];

  const close = () => {
    setDialog(null);
    remove.reset();
  };

  const dialogs: ReactNode = (
    <>
      <CancelNotificationDialog notification={dialog === "cancel" ? n : null} onClose={close} />
      <ConfirmDialog
        open={dialog === "delete"}
        onClose={close}
        danger
        title={`Excluir “${n.title}”?`}
        description="Ela nunca foi enviada. Some da lista de vez."
        confirmLabel="Excluir notificação"
        loading={remove.isPending}
        error={remove.error}
        onConfirm={() =>
          remove.mutate(n.id, {
            onSuccess: () => {
              close();
              toast.success("Notificação excluída.");
              onDeleted?.();
            },
          })
        }
      />
    </>
  );

  return { primary, menu, dialogs, busy: toDraft.isPending || remove.isPending };
}

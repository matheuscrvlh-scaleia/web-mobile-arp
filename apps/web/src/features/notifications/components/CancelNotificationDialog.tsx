import type { PushNotification } from "@arp/contracts";
import { formatDateTime } from "@/shared/lib/format";
import { ConfirmDialog, toast } from "@/shared/ui";
import { useCancelNotification } from "../api";

/** Cancelar uma notificação agendada (antes de sair). */
export function CancelNotificationDialog({
  notification,
  onClose,
}: {
  notification: PushNotification | null;
  onClose: () => void;
}) {
  const cancel = useCancelNotification();
  const close = () => {
    cancel.reset();
    onClose();
  };
  return (
    <ConfirmDialog
      open={notification !== null}
      onClose={close}
      danger
      title={`Cancelar o envio de “${notification?.title ?? ""}”?`}
      description={
        notification?.scheduledAt
          ? `Não vai sair em ${formatDateTime(notification.scheduledAt)}. Depois dá para voltar para rascunho e agendar de novo.`
          : "Não vai ser enviada. Depois dá para voltar para rascunho e agendar de novo."
      }
      confirmLabel="Cancelar envio"
      cancelLabel="Manter agendamento"
      loading={cancel.isPending}
      error={cancel.error}
      onConfirm={() => {
        if (!notification) return;
        cancel.mutate(notification.id, {
          onSuccess: () => {
            toast.success("Envio cancelado.");
            close();
          },
        });
      }}
    />
  );
}

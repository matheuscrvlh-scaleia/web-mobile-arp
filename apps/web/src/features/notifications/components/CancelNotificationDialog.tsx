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
      title="Cancelar o envio?"
      description={
        notification?.scheduledAt
          ? `"${notification.title}" não vai sair em ${formatDateTime(notification.scheduledAt)}.`
          : `"${notification?.title ?? ""}" não vai ser enviada.`
      }
      confirmLabel="Cancelar envio"
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

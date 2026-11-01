import type { PushNotification } from "@arp/contracts";
import { Bell, CalendarX, Link2, Send, UserRound, Users } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router";
import { useAuth } from "@/shared/auth";
import { PATHS } from "@/shared/config/paths";
import { formatDateTime, formatNumber } from "@/shared/lib/format";
import {
  Button,
  Card,
  CardHeader,
  InfoItem,
  LoadError,
  LoadingRegion,
  PageHeader,
  Skeleton,
} from "@/shared/ui";
import { useNotification } from "../api";
import { CancelNotificationDialog } from "../components/CancelNotificationDialog";
import {
  AUDIENCE,
  audienceText,
  NotificationStatusBadge,
  notificationWhen,
} from "../components/NotificationBadges";
import { NotificationForm } from "../components/NotificationForm";
import { PushPreview } from "../components/PushPreview";

const BACK = { to: PATHS.notifications, label: "Notificações" };

export function NotificationDetailPage() {
  const { id = "" } = useParams();
  const { can } = useAuth();
  const notification = useNotification(id);

  if (notification.error && !notification.data) {
    return (
      <>
        <PageHeader title="Notificação" back={BACK} />
        <LoadError
          error={notification.error}
          onRetry={() => void notification.refetch()}
          icon={Bell}
          title="Notificação não encontrada"
          description="Ela pode ter sido apagada ou o endereço está errado."
          back={{ to: PATHS.notifications, label: "Ver notificações" }}
        />
      </>
    );
  }

  if (!notification.data) {
    return (
      <LoadingRegion>
        <Skeleton className="h-12 w-80 max-w-full rounded-full" />
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <Skeleton className="h-[32rem] rounded-[1.75rem]" />
          <Skeleton className="h-[36rem] rounded-[3rem]" />
        </div>
      </LoadingRegion>
    );
  }

  const n = notification.data;
  const editable = n.status === "draft" && can("notifications.manage");
  return (
    <>
      <PageHeader
        title={editable ? "Editar rascunho" : n.title}
        documentTitle={n.title}
        description={editable ? "Ajuste o texto e o público; depois envie ou agende." : undefined}
        back={BACK}
        actions={<NotificationStatusBadge status={n.status} />}
      />
      {editable ? <NotificationForm notification={n} /> : <NotificationSummary notification={n} />}
    </>
  );
}

/** Notificação que já saiu do rascunho: só leitura (e cancelar, se agendada). */
function NotificationSummary({ notification: n }: { notification: PushNotification }) {
  const [cancelling, setCancelling] = useState(false);
  const { can } = useAuth();
  const sent = n.status === "sent";
  return (
    <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="flex min-w-0 flex-col gap-5">
        <Card>
          <CardHeader
            title="Mensagem"
            icon={Bell}
            action={
              n.status === "scheduled" && can("notifications.manage") ? (
                <Button
                  variant="danger"
                  size="sm"
                  icon={CalendarX}
                  onClick={() => setCancelling(true)}
                >
                  Cancelar envio
                </Button>
              ) : undefined
            }
          />
          <p className="font-semibold text-neutral-900">{n.title}</p>
          <p className="mt-1 text-sm whitespace-pre-line text-neutral-600">{n.body}</p>
        </Card>
        <Card>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <InfoItem label="Público" icon={AUDIENCE[n.audience].icon}>
              {audienceText(n)}
            </InfoItem>
            <InfoItem label={sent ? "Pessoas que receberam" : "Estimativa de público"} icon={Users}>
              {n.recipientsCount === null
                ? "—"
                : `${sent ? "" : "≈ "}${formatNumber(n.recipientsCount)}`}
            </InfoItem>
            <InfoItem label="Envio" icon={Send}>
              {notificationWhen(n) ?? "Não enviada"}
            </InfoItem>
            <InfoItem label="Ao tocar" icon={Link2}>
              {n.deepLink ? (
                <code className="font-mono text-xs">{n.deepLink}</code>
              ) : (
                "Abre o início"
              )}
            </InfoItem>
            <InfoItem label="Criada por" icon={UserRound}>
              {n.createdBy.name} · {formatDateTime(n.createdAt)}
            </InfoItem>
          </div>
        </Card>
      </div>
      <aside aria-label="Prévia da notificação" className="xl:sticky xl:top-4">
        <PushPreview title={n.title} body={n.body} />
      </aside>
      <CancelNotificationDialog
        notification={cancelling ? n : null}
        onClose={() => setCancelling(false)}
      />
    </div>
  );
}

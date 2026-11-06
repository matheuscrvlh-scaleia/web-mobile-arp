import type { PushNotification } from "@arp/contracts";
import { Bell, Link2, Send, UserRound, Users } from "lucide-react";
import { useNavigate, useParams } from "react-router";
import { useAuth } from "@/shared/auth";
import { PATHS } from "@/shared/config/paths";
import { formatDateTime, formatNumber } from "@/shared/lib/format";
import {
  ActionMenu,
  Button,
  Card,
  CardHeader,
  DemoMark,
  InfoItem,
  LoadError,
  LoadingRegion,
  PageHeader,
  Skeleton,
} from "@/shared/ui";
import { useNotification } from "../api";
import { DeepLinkIssue, useDeepLinkIssue, useDeepLinkSummary } from "../components/DeepLinkField";
import {
  AUDIENCE,
  audienceText,
  NotificationStatusBadge,
  notificationWhen,
} from "../components/NotificationBadges";
import { NotificationForm } from "../components/NotificationForm";
import { PushPreview } from "../components/PushPreview";
import { useNotificationActions } from "../components/useNotificationActions";

const BACK = { to: PATHS.notifications, label: "Notificações" };

export function NotificationDetailPage() {
  const { id = "" } = useParams();
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
          description="Ela pode ter sido excluída ou o endereço está errado."
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

  return <NotificationDetail notification={notification.data} />;
}

function NotificationDetail({ notification: n }: { notification: PushNotification }) {
  const navigate = useNavigate();
  const { can } = useAuth();
  const canManage = can("notifications.manage");
  const editable = n.status === "draft" && canManage;
  const { primary, menu, dialogs, busy } = useNotificationActions(n, {
    onDeleted: () => navigate(PATHS.notifications),
  });

  return (
    <>
      <PageHeader
        title={
          editable ? (
            "Editar rascunho"
          ) : (
            <>
              {n.title} <DemoMark show={n.isDemo} />
            </>
          )
        }
        documentTitle={n.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <NotificationStatusBadge status={n.status} scheduledAt={n.scheduledAt} />
            {editable
              ? "Ajuste o texto e o público; depois agende ou envie."
              : (notificationWhen(n) ?? undefined)}
          </span>
        }
        back={BACK}
        actions={
          canManage && (
            <>
              {primary && (
                <Button
                  variant={primary.danger ? "secondary" : "brand"}
                  icon={primary.icon}
                  loading={busy}
                  onClick={primary.run}
                >
                  {primary.label}
                </Button>
              )}
              <ActionMenu items={menu} label="Mais" ariaLabel={`Mais ações de ${n.title}`} />
            </>
          )
        }
      />
      {editable ? <NotificationForm notification={n} /> : <NotificationSummary notification={n} />}
      {dialogs}
    </>
  );
}

/** Notificação que já saiu do rascunho: só leitura. */
function NotificationSummary({ notification: n }: { notification: PushNotification }) {
  const sent = n.status === "sent";
  const link = useDeepLinkSummary(n.deepLink);
  const linkIssue = useDeepLinkIssue(sent ? null : n.deepLink);
  return (
    <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="flex min-w-0 flex-col gap-5">
        <Card>
          <CardHeader title="Mensagem" icon={Bell} />
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
              <span className="whitespace-normal">{link}</span>
            </InfoItem>
            <InfoItem label="Criada por" icon={UserRound}>
              {n.createdBy.name} · {formatDateTime(n.createdAt)}
            </InfoItem>
          </div>
          {linkIssue && (
            <div className="mt-5">
              <DeepLinkIssue text={linkIssue} />
            </div>
          )}
        </Card>
      </div>
      <aside aria-label="Prévia da notificação" className="xl:sticky xl:top-4">
        <PushPreview title={n.title} body={n.body} />
      </aside>
    </div>
  );
}

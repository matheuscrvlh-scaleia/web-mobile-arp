import { buildDeepLink, type PushNotification } from "@arp/contracts";
import { useMemo } from "react";
import { useSearchParams } from "react-router";
import { useEvent } from "@/features/events";
import { useAuth } from "@/shared/auth";
import { PATHS } from "@/shared/config/paths";
import { useDuplicateSource } from "@/shared/hooks";
import { LoadingRegion, PageHeader, Skeleton } from "@/shared/ui";
import { useNotification } from "../api";
import { NotificationForm } from "../components/NotificationForm";

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * Nova notificação. `?de=<id>` = "Duplicar" / "Usar como base";
 * `?evento=<id>&motivo=adiado|cancelado` = aviso de um evento já preenchido.
 */
export function NotificationCreatePage() {
  const sourceId = useDuplicateSource();
  const source = useNotification(sourceId ?? undefined);
  const [params] = useSearchParams();
  const eventId = params.get("evento");
  const reason = params.get("motivo");
  const event = useEvent(eventId && UUID.test(eventId) ? eventId : undefined);
  const { user } = useAuth();

  const fromEvent = useMemo<PushNotification | undefined>(() => {
    if (!event.data) return undefined;
    const e = event.data;
    const title =
      reason === "cancelado"
        ? `Cancelado: ${e.title}`
        : reason === "adiado"
          ? `Nova data: ${e.title}`
          : e.title;
    const body =
      reason === "cancelado"
        ? "Este evento foi cancelado. Toque para ver os detalhes."
        : reason === "adiado"
          ? "Mudou de data. Toque para ver o novo dia e horário."
          : "Toque para ver os detalhes na agenda.";
    const now = new Date().toISOString();
    return {
      id: "",
      title: title.slice(0, 65),
      body,
      // Aviso de serviço: vai para quem marcou interesse (se houver alguém).
      audience: e.interestsCount > 0 ? "event_interested" : "opted_in",
      store: null,
      event: { id: e.id, name: e.title },
      deepLink: buildDeepLink({ kind: "event", id: e.id }),
      scheduledAt: null,
      sentAt: null,
      status: "draft",
      recipientsCount: null,
      createdBy: { id: user?.id ?? "", name: user?.name ?? "" },
      createdAt: now,
      updatedAt: now,
    };
  }, [event.data, reason, user]);

  const waiting = (sourceId && !source.data && !source.error) || (eventId && event.isLoading);
  if (waiting) {
    return (
      <LoadingRegion>
        <Skeleton className="h-12 w-80 max-w-full rounded-full" />
        <Skeleton className="h-[32rem] rounded-[1.75rem]" />
      </LoadingRegion>
    );
  }

  const copyOf = source.data ?? fromEvent;
  return (
    <>
      <PageHeader
        title={source.data ? "Nova notificação a partir de outra" : "Nova notificação"}
        description={
          source.data
            ? `Texto, público e destino vieram de “${source.data.title}”. Ajuste e agende.`
            : fromEvent
              ? `Aviso sobre “${event.data?.title}”: o toque já abre o evento.`
              : "Escreva, veja como chega no celular e agende (ou envie agora)."
        }
        back={{ to: PATHS.notifications, label: "Notificações" }}
      />
      <NotificationForm copyOf={copyOf} />
    </>
  );
}

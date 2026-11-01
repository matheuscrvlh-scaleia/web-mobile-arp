import type { NotificationAudience, NotificationStatus, PushNotification } from "@arp/contracts";
import {
  BellRing,
  CalendarClock,
  CircleOff,
  type LucideIcon,
  Pencil,
  Send,
  Store,
  Users,
} from "lucide-react";
import { formatDateTime } from "@/shared/lib/format";
import { StatusBadge, type StatusTone } from "@/shared/ui";

export const NOTIFICATION_STATUS: Record<
  NotificationStatus,
  { label: string; tone: StatusTone; icon: LucideIcon }
> = {
  draft: { label: "Rascunho", tone: "neutral", icon: Pencil },
  scheduled: { label: "Agendada", tone: "info", icon: CalendarClock },
  sent: { label: "Enviada", tone: "success", icon: Send },
  cancelled: { label: "Cancelada", tone: "neutral", icon: CircleOff },
};

export const AUDIENCE: Record<
  NotificationAudience,
  { label: string; description: string; icon: LucideIcon }
> = {
  all: {
    label: "Todos",
    description: "Todo mundo com o app e notificações ligadas.",
    icon: Users,
  },
  opted_in: {
    label: "Aceitam ofertas",
    description: "Só quem aceitou receber comunicação (opt-in). Use para promoções.",
    icon: BellRing,
  },
  store_followers: {
    label: "Seguidores de uma loja",
    description: 'Quem pediu "Avisar ofertas" da loja escolhida.',
    icon: Store,
  },
};

export function NotificationStatusBadge({ status }: { status: NotificationStatus }) {
  const s = NOTIFICATION_STATUS[status];
  return (
    <StatusBadge tone={s.tone} icon={s.icon}>
      {s.label}
    </StatusBadge>
  );
}

/** Quando saiu ou vai sair ("Enviada 31/10/2026 às 18:00"). */
export function notificationWhen(n: Pick<PushNotification, "status" | "scheduledAt" | "sentAt">) {
  if (n.status === "sent" && n.sentAt) return `Enviada ${formatDateTime(n.sentAt)}`;
  if (n.status === "scheduled" && n.scheduledAt) return `Para ${formatDateTime(n.scheduledAt)}`;
  if (n.status === "cancelled" && n.scheduledAt) return `Era para ${formatDateTime(n.scheduledAt)}`;
  return null;
}

/** Público em texto ("Seguidores de Casa Brava"). */
export function audienceText(n: Pick<PushNotification, "audience" | "store">) {
  if (n.audience === "store_followers") return `Seguidores de ${n.store?.name ?? "uma loja"}`;
  return AUDIENCE[n.audience].label;
}

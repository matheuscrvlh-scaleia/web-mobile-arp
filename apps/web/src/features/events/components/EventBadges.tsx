import type { EventRecurrence, EventStatus } from "@arp/contracts";
import { Award, CircleDashed, CircleOff, Globe, Heart, Pause, Radio } from "lucide-react";
import { formatNumber } from "@/shared/lib/format";
import { StatusBadge } from "@/shared/ui";

export const EVENT_STATUS_LABEL: Record<EventStatus, string> = {
  draft: "Rascunho",
  published: "Publicado",
  paused: "Pausado",
  cancelled: "Cancelado",
};

export const RECURRENCE_LABEL: Record<EventRecurrence, string> = {
  single: "Único",
  range: "Período",
  weekly: "Semanal",
};

export function EventStatusBadge({ status }: { status: EventStatus }) {
  if (status === "published")
    return (
      <StatusBadge tone="success" icon={Radio}>
        Publicado
      </StatusBadge>
    );
  if (status === "paused")
    return (
      <StatusBadge tone="warning" icon={Pause}>
        Pausado (fora do app)
      </StatusBadge>
    );
  if (status === "cancelled")
    return (
      <StatusBadge tone="danger" icon={CircleOff}>
        Cancelado
      </StatusBadge>
    );
  return (
    <StatusBadge tone="neutral" icon={CircleDashed}>
      Rascunho (fora do app)
    </StatusBadge>
  );
}

export function SealPill() {
  return (
    <StatusBadge tone="brand" icon={Award}>
      Vale selo
    </StatusBadge>
  );
}

/** Veio da importação do site (espacoarp.com.br). */
export function SitePill() {
  return (
    <StatusBadge tone="info" icon={Globe}>
      Do site
    </StatusBadge>
  );
}

export function InterestsCount({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-neutral-500">
      <Heart className="size-3.5" aria-hidden />
      {formatNumber(count)}
      <span className="sr-only"> pessoas com interesse</span>
    </span>
  );
}

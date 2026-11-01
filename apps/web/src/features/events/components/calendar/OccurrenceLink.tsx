import type { EventStatus } from "@arp/contracts";
import { Link } from "react-router";
import { PATHS } from "@/shared/config/paths";
import { cn } from "@/shared/lib/cn";
import { formatTimeOfDay } from "@/shared/lib/format";
import type { Occurrence } from "../../lib/calendar";

/** Texto da situação que não é "publicado" (a cor nunca vem sozinha). */
export const statusSuffix = (status: EventStatus) =>
  status === "draft" ? " (rascunho)" : status === "cancelled" ? " (cancelado)" : "";

/** Classe visual de rascunho (tracejado) e cancelado (riscado). */
export const statusLook = (status: EventStatus) =>
  cn(
    status === "draft" && "border border-dashed border-neutral-400 bg-transparent",
    status === "cancelled" && "line-through opacity-60",
  );

/** Um evento dentro do dia: hora + título, link para o evento. */
export function OccurrenceLink({ event, size = "sm" }: { event: Occurrence; size?: "sm" | "md" }) {
  return (
    <Link
      to={PATHS.event(event.id)}
      title={`${event.title}${statusSuffix(event.status)}`}
      className={cn(
        "flex min-w-0 items-baseline gap-1 rounded-lg bg-neutral-900/[0.05] transition hover:bg-neutral-900/[0.1]",
        size === "sm" ? "px-1.5 py-0.5 text-[11px]" : "px-3 py-2 text-sm",
        statusLook(event.status),
      )}
    >
      {event.startTime && (
        <span className="shrink-0 font-semibold tabular-nums">
          {formatTimeOfDay(event.startTime)}
        </span>
      )}
      <span className="truncate">{event.title}</span>
      <span className="sr-only">{statusSuffix(event.status)}</span>
    </Link>
  );
}

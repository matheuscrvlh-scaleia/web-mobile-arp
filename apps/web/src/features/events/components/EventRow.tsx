import type { Event } from "@arp/contracts";
import { Archive, CalendarDays, MapPin } from "lucide-react";
import { Link } from "react-router";
import { PATHS } from "@/shared/config/paths";
import { cn } from "@/shared/lib/cn";
import { ActionMenu, DemoMark, StatusBadge } from "@/shared/ui";
import { describeWhen } from "../lib/when";
import { EventStatusBadge, InterestsCount, SealPill, SitePill } from "./EventBadges";
import { EventThumb } from "./EventThumb";
import { useEventActions } from "./useEventActions";

/**
 * Linha da agenda, como o `.ev-row` do app: miniatura, quando, onde e as
 * etiquetas. A linha toda abre o evento; o "⋯" no fim tem as ações.
 */
export function EventRow({ event, canManage = false }: { event: Event; canManage?: boolean }) {
  const where = [event.place, event.floor?.label].filter(Boolean).join(" · ");
  return (
    <div className="group flex items-center gap-1 rounded-[1.4rem] pr-2 transition hover:bg-white/60">
      <Link
        to={PATHS.event(event.id)}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-4 rounded-[1.4rem] p-2",
          event.status === "cancelled" && "opacity-70",
        )}
      >
        <EventThumb
          imageUrl={event.imageUrl}
          tone={event.tone}
          icon={event.icon ?? event.category.icon}
          className="size-20 shrink-0 rounded-[1.1rem] sm:size-24"
          sizes="96px"
        />
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "truncate font-semibold text-neutral-900",
              event.status === "cancelled" && "line-through",
            )}
          >
            {event.title}
            <DemoMark show={event.isDemo} className="ml-1.5" />
          </p>
          <div className="mt-1 flex flex-col gap-0.5 text-xs text-neutral-600">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{describeWhen(event)}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{where}</span>
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-neutral-900/[0.06] px-2.5 py-1 text-xs font-medium text-neutral-700">
              {event.category.name}
            </span>
            {event.awardsSeal && <SealPill />}
            {event.siteUrl && <SitePill />}
            {event.archivedAt ? (
              <StatusBadge tone="outline" icon={Archive}>
                Arquivado
              </StatusBadge>
            ) : (
              <EventStatusBadge status={event.status} />
            )}
            <InterestsCount count={event.interestsCount} />
          </div>
        </div>
      </Link>
      {canManage && <RowMenu event={event} />}
    </div>
  );
}

/** "⋯" da linha: mostrar ou não no app (o evento vem do site). */
function RowMenu({ event }: { event: Event }) {
  const { action } = useEventActions(event);
  return (
    <ActionMenu
      size="sm"
      ariaLabel={`Mais ações de ${event.title}`}
      items={[{ label: action.label, icon: action.icon, onSelect: action.run }]}
    />
  );
}

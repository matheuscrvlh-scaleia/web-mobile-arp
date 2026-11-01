import { CalendarDays } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { monthBounds } from "@/shared/lib/dates";
import type { Occurrence } from "../../lib/calendar";
import { longDay } from "../../lib/when";
import { OccurrenceLink } from "./OccurrenceLink";

/** Versão do celular: só os dias do mês que têm evento, em lista. */
export function AgendaList({
  month,
  today,
  byDay,
}: {
  month: string;
  today: string;
  byDay: Map<string, Occurrence[]>;
}) {
  const [first, last] = monthBounds(month);
  const days = [...byDay.entries()]
    .filter(([d, events]) => d >= first && d <= last && events.length > 0)
    .sort(([a], [b]) => a.localeCompare(b));

  if (days.length === 0) {
    return (
      <p className="flex items-center justify-center gap-2 py-8 text-sm text-neutral-500">
        <CalendarDays className="size-4" aria-hidden />
        Nenhum evento dia a dia neste mês.
      </p>
    );
  }
  return (
    <ol className="flex flex-col gap-4">
      {days.map(([day, events]) => (
        <li key={day}>
          <h3
            className={cn(
              "mb-2 text-sm font-semibold text-neutral-800",
              day === today && "text-green-700",
            )}
          >
            {day === today ? `Hoje · ${longDay(day)}` : longDay(day)}
          </h3>
          <ul className="flex flex-col gap-1.5">
            {events.map((e) => (
              <li key={e.id}>
                <OccurrenceLink event={e} size="md" />
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

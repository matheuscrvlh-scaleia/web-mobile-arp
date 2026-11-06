import { Plus } from "lucide-react";
import { Link } from "react-router";
import { PATHS } from "@/shared/config/paths";
import { cn } from "@/shared/lib/cn";
import { WEEKDAY_SHORT } from "@/shared/lib/dates";
import { plural } from "@/shared/lib/format";
import { type LongEvent, monthWeeks, type Occurrence, weekBands } from "../../lib/calendar";
import { longDay } from "../../lib/when";
import { OccurrenceLink, statusLook, statusSuffix } from "./OccurrenceLink";

const MAX_PER_DAY = 3;

/** "Novo evento" já com o dia escolhido. */
const newEventOn = (day: string) => `${PATHS.eventNew}?dia=${day}`;

/**
 * Mês em grade (domingo a sábado). Eventos longos atravessam os dias como
 * faixa; os demais aparecem por dia, com a hora.
 */
export function MonthGrid({
  month,
  today,
  byDay,
  longs,
  canCreate = false,
}: {
  month: string;
  today: string;
  byDay: Map<string, Occurrence[]>;
  longs: LongEvent[];
  /** Clicar no dia abre "Novo evento" com a data. */
  canCreate?: boolean;
}) {
  const weeks = monthWeeks(month);
  return (
    <div className="overflow-hidden rounded-[1.4rem] border border-neutral-900/[0.08]">
      <div aria-hidden className="grid grid-cols-7 border-b border-neutral-900/[0.08] bg-white/40">
        {WEEKDAY_SHORT.map((d) => (
          <span key={d} className="px-2 py-2 text-xs font-medium text-neutral-500 capitalize">
            {d}
          </span>
        ))}
      </div>
      <ol aria-label="Semanas do mês" className="divide-y divide-neutral-900/[0.08]">
        {weeks.map((week) => (
          <Week
            key={week[0]}
            week={week}
            month={month}
            today={today}
            byDay={byDay}
            bands={weekBands(week, longs)}
            canCreate={canCreate}
          />
        ))}
      </ol>
    </div>
  );
}

function Week({
  week,
  month,
  today,
  byDay,
  bands,
  canCreate,
}: {
  week: string[];
  month: string;
  today: string;
  byDay: Map<string, Occurrence[]>;
  bands: ReturnType<typeof weekBands>;
  canCreate: boolean;
}) {
  const listRow = bands.length + 2;
  return (
    <li
      className="grid min-h-28 grid-cols-7"
      style={{ gridTemplateRows: `auto repeat(${bands.length}, auto) 1fr` }}
    >
      {week.map((day, i) => {
        const look = cn(
          "border-neutral-900/[0.08] not-first:border-l",
          !day.startsWith(month) && "bg-neutral-900/[0.025]",
          day === today && "bg-marca/10",
        );
        const place = { gridColumn: i + 1, gridRow: "1 / -1" };
        // Fundo do dia clicável (o "+" ao lado do número é o caminho pelo teclado).
        return canCreate ? (
          <Link
            key={`bg-${day}`}
            to={newEventOn(day)}
            aria-hidden
            tabIndex={-1}
            className={cn(look, "transition hover:bg-neutral-900/[0.04]")}
            style={place}
          />
        ) : (
          <span key={`bg-${day}`} aria-hidden className={look} style={place} />
        );
      })}
      {week.map((day, i) => (
        <span
          key={`n-${day}`}
          className="group/day pointer-events-none flex items-center justify-between px-2 pt-1.5 pb-1"
          style={{ gridColumn: i + 1, gridRow: 1 }}
        >
          <span
            className={cn(
              "inline-grid size-6 place-items-center rounded-full text-xs tabular-nums",
              day.startsWith(month) ? "text-neutral-800" : "text-neutral-400",
              day === today && "bg-neutral-900 font-semibold text-white",
            )}
          >
            {Number(day.slice(8))}
          </span>
          <span className="sr-only">
            {longDay(day)}
            {day === today ? " (hoje)" : ""}
          </span>
          {canCreate && (
            <Link
              to={newEventOn(day)}
              aria-label={`Novo evento em ${longDay(day)}`}
              title="Novo evento neste dia"
              className="pointer-events-auto grid size-6 place-items-center rounded-full text-neutral-400 opacity-0 transition group-hover/day:opacity-100 hover:bg-neutral-900 hover:text-white focus-visible:opacity-100"
            >
              <Plus className="size-3.5" aria-hidden />
            </Link>
          )}
        </span>
      ))}
      {bands.map((row, r) =>
        row.map((b) => (
          <Link
            key={`${b.event.id}-${b.start}`}
            to={PATHS.event(b.event.id)}
            title={`${b.event.title}${statusSuffix(b.event.status)}`}
            className={cn(
              "mx-1 mb-1 truncate rounded-md px-2 py-0.5 text-[11px] font-semibold",
              b.event.status === "draft" ? "text-neutral-700" : "tom-app-deep",
              statusLook(b.event.status),
            )}
            style={{ gridColumn: `${b.start + 1} / ${b.end + 2}`, gridRow: r + 2 }}
          >
            {b.event.title}
            <span className="sr-only">
              {statusSuffix(b.event.status)}, de {longDay(week[b.start] ?? "")} a{" "}
              {longDay(week[b.end] ?? "")}
            </span>
          </Link>
        )),
      )}
      {week.map((day, i) => {
        const events = byDay.get(day) ?? [];
        const extra = events.length - MAX_PER_DAY;
        return (
          <ul
            key={`l-${day}`}
            className="pointer-events-none flex min-w-0 flex-col gap-1 px-1 pb-2 *:pointer-events-auto"
            style={{ gridColumn: i + 1, gridRow: listRow }}
          >
            {events.slice(0, MAX_PER_DAY).map((e) => (
              <li key={e.id} className="min-w-0">
                <OccurrenceLink event={e} />
              </li>
            ))}
            {extra > 0 && (
              <li>
                <Link
                  to={`${PATHS.events}?from=${day}&to=${day}`}
                  className="px-1.5 text-[11px] font-medium text-neutral-500 underline-offset-2 hover:underline"
                >
                  +{plural(extra, "evento", "eventos")}
                </Link>
              </li>
            )}
          </ul>
        );
      })}
    </li>
  );
}

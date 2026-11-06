import { addDaysToDate, weekdayOfDate } from "../../../shared/domain/time";

export interface EventRecurrence {
  recurrence: "single" | "range" | "weekly";
  /** YYYY-MM-DD */
  startsOn: string;
  endsOn: string | null;
  /** weekly: dias da semana (0 = domingo). */
  weekdays: number[] | null;
}

/** O evento acontece neste dia de calendário (YYYY-MM-DD)? */
export function occursOn(event: EventRecurrence, date: string): boolean {
  if (date < event.startsOn) return false;
  switch (event.recurrence) {
    case "single":
      return date === event.startsOn;
    case "range":
      return event.endsOn !== null && date <= event.endsOn;
    case "weekly":
      return (
        (event.endsOn === null || date <= event.endsOn) &&
        (event.weekdays ?? []).includes(weekdayOfDate(date))
      );
  }
}

/** Primeiro dia em que acontece a partir de `from` (inclusive), ou null se já terminou. */
export function nextOccurrence(event: EventRecurrence, from: string): string | null {
  const start = event.startsOn > from ? event.startsOn : from;
  let candidate: string;
  switch (event.recurrence) {
    case "single":
      return event.startsOn >= from ? event.startsOn : null;
    case "range":
      candidate = start;
      break;
    case "weekly": {
      if (!event.weekdays?.length) return null;
      const today = weekdayOfDate(start);
      const delta = Math.min(...event.weekdays.map((d) => (d - today + 7) % 7));
      candidate = addDaysToDate(start, delta);
      break;
    }
  }
  return event.endsOn !== null && candidate > event.endsOn ? null : candidate;
}

/** Todos os dias de `from` a `to` (inclusive). */
export function datesBetween(from: string, to: string): string[] {
  const dates: string[] = [];
  for (let d = from; d <= to; d = addDaysToDate(d, 1)) dates.push(d);
  return dates;
}

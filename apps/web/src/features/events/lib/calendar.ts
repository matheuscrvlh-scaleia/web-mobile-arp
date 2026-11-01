import type { EventOccurrences, EventStatus } from "@arp/contracts";
import { addDaysIso, monthBounds, weekdayOfIso } from "@/shared/lib/dates";

export type Occurrence = EventOccurrences["data"][number]["events"][number];

/** Evento longo (faixa): os dias do intervalo em que acontece. */
export interface LongEvent {
  id: string;
  title: string;
  status: EventStatus;
  days: Set<string>;
}

export interface Band {
  event: LongEvent;
  /** Coluna (0 = domingo) onde a faixa começa e termina nesta semana. */
  start: number;
  end: number;
}

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
export const isMonth = (v: string | null): v is string => v !== null && MONTH_PATTERN.test(v);

/** Semanas (domingo a sábado) que cobrem o mês inteiro. */
export function monthWeeks(month: string): string[][] {
  const [first, last] = monthBounds(month);
  let day = addDaysIso(first, -weekdayOfIso(first));
  const end = addDaysIso(last, 6 - weekdayOfIso(last));
  const weeks: string[][] = [];
  while (day <= end) {
    const week: string[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(day);
      day = addDaysIso(day, 1);
    }
    weeks.push(week);
  }
  return weeks;
}

/** Separa os eventos longos (faixas) dos que aparecem dia a dia. */
export function splitOccurrences(data: EventOccurrences["data"]) {
  const byDay = new Map<string, Occurrence[]>();
  const longs = new Map<string, LongEvent>();
  for (const { date, events } of data) {
    const daily: Occurrence[] = [];
    for (const e of events) {
      if (e.isLongRunning) {
        const l = longs.get(e.id) ?? {
          id: e.id,
          title: e.title,
          status: e.status,
          days: new Set(),
        };
        l.days.add(date);
        longs.set(e.id, l);
      } else {
        daily.push(e);
      }
    }
    daily.sort((a, b) => (a.startTime ?? "99").localeCompare(b.startTime ?? "99"));
    byDay.set(date, daily);
  }
  return { byDay, longs: [...longs.values()] };
}

/** Pedaços contínuos de cada evento longo dentro da semana (um por linha). */
export function weekBands(week: string[], longs: LongEvent[]): Band[][] {
  const rows: Band[][] = [];
  for (const event of longs) {
    const row: Band[] = [];
    let start = -1;
    week.forEach((day, i) => {
      const on = event.days.has(day);
      if (on && start < 0) start = i;
      if ((!on || i === week.length - 1) && start >= 0) {
        row.push({ event, start, end: on ? i : i - 1 });
        start = -1;
      }
    });
    if (row.length > 0) rows.push(row);
  }
  return rows;
}

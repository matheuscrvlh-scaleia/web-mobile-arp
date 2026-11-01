/** Datas do seed no fuso do negócio (America/Sao_Paulo), sem depender do fuso da máquina. */

export const BUSINESS_TIME_ZONE = "America/Sao_Paulo";

export const HOUR_MS = 3_600_000;
export const DAY_MS = 24 * HOUR_MS;

const MONTHS_PT = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

const partsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  weekday: "short",
});

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface LocalParts {
  /** YYYY-MM-DD */
  date: string;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  /** 0 = domingo */
  weekday: number;
}

/** Data/hora local (São Paulo) de um instante. */
export function localParts(at: Date): LocalParts {
  const p = Object.fromEntries(partsFormatter.formatToParts(at).map((x) => [x.type, x.value]));
  const year = Number(p.year);
  const month = Number(p.month);
  const day = Number(p.day);
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    year,
    month,
    day,
    hour: Number(p.hour),
    minute: Number(p.minute),
    weekday: WEEKDAYS.indexOf(String(p.weekday)),
  };
}

/** Diferença (ms) entre o relógio local e UTC naquele instante. */
function offsetMs(at: Date): number {
  const p = localParts(at);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return asUtc - Math.floor(at.getTime() / 60_000) * 60_000;
}

/** Instante de uma data/hora local de São Paulo ("2026-10-31", "19:30"). */
export function zoned(date: string, time = "00:00"): Date {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const [hh, mm] = time.split(":").map(Number) as [number, number];
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  // Duas passadas acertam o offset mesmo perto de troca de horário de verão.
  let at = new Date(guess - offsetMs(new Date(guess)));
  at = new Date(guess - offsetMs(at));
  return at;
}

/** Soma dias a uma data de calendário (sem fuso). */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function monthName(month: number): string {
  return MONTHS_PT[(month - 1 + 12) % 12] as string;
}

/** Âncoras de tempo do seed: tudo é relativo ao "agora" em São Paulo. */
export interface SeedClock {
  now: Date;
  today: string;
  /** Instante de hoje + n dias, na hora local informada. */
  at(dayOffset: number, time?: string): Date;
  /** Primeiro dia do mês corrente + n meses (YYYY-MM-DD). */
  monthStart(monthOffset?: number): string;
  /** Último dia do mês corrente + n meses (YYYY-MM-DD). */
  monthEnd(monthOffset?: number): string;
  /** Nome do mês corrente + n meses ("outubro"). */
  monthLabel(monthOffset?: number): string;
}

export function createSeedClock(now: Date = new Date()): SeedClock {
  const local = localParts(now);
  const firstOf = (offset: number) => {
    const d = new Date(Date.UTC(local.year, local.month - 1 + offset, 1));
    return d.toISOString().slice(0, 10);
  };
  return {
    now,
    today: local.date,
    at: (dayOffset, time = "00:00") => zoned(addDays(local.date, dayOffset), time),
    monthStart: (offset = 0) => firstOf(offset),
    monthEnd: (offset = 0) => addDays(firstOf(offset + 1), -1),
    monthLabel: (offset = 0) => monthName(local.month + offset),
  };
}

import { addDaysToDate, toLocal } from "../../../domain/time";

/** Datas dos dados de demonstração no fuso do negócio, sem depender do fuso da máquina. */

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

/** Diferença (ms) entre o relógio local e UTC naquele instante. */
function offsetMs(at: Date): number {
  const p = toLocal(at);
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

/** Âncoras de tempo: tudo é relativo ao "agora" em São Paulo. */
export interface DemoClock {
  now: Date;
  /** Instante de hoje + n dias, na hora local informada. */
  at(dayOffset: number, time?: string): Date;
  /** Primeiro dia do mês corrente + n meses (YYYY-MM-DD). */
  monthStart(monthOffset?: number): string;
  /** Último dia do mês corrente + n meses (YYYY-MM-DD). */
  monthEnd(monthOffset?: number): string;
  /** Nome do mês corrente + n meses ("outubro"). */
  monthLabel(monthOffset?: number): string;
}

export function createDemoClock(now: Date): DemoClock {
  const local = toLocal(now);
  const firstOf = (offset: number) =>
    new Date(Date.UTC(local.year, local.month - 1 + offset, 1)).toISOString().slice(0, 10);
  return {
    now,
    at: (dayOffset, time = "00:00") => zoned(addDaysToDate(local.date, dayOffset), time),
    monthStart: (offset = 0) => firstOf(offset),
    monthEnd: (offset = 0) => addDaysToDate(firstOf(offset + 1), -1),
    monthLabel: (offset = 0) => MONTHS_PT[(((local.month - 1 + offset) % 12) + 12) % 12] as string,
  };
}

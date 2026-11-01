/**
 * Datas no fuso do negócio. O app e o painel vivem em America/Sao_Paulo:
 * "aberto agora", "mês da campanha" e o dashboard dependem do relógio local,
 * nunca do fuso da máquina onde a API roda.
 */
export const BUSINESS_TIME_ZONE = "America/Sao_Paulo";

export interface LocalDateTime {
  /** YYYY-MM-DD */
  date: string;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  /** 0 = domingo … 6 = sábado */
  weekday: number;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      weekday: "short",
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

/** Data e hora locais de um instante no fuso indicado (padrão: São Paulo). */
export function toLocal(at: Date, timeZone = BUSINESS_TIME_ZONE): LocalDateTime {
  const parts = Object.fromEntries(
    formatterFor(timeZone)
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekday: WEEKDAYS.indexOf(parts.weekday ?? ""),
  };
}

/** "HH:mm" ou "HH:mm:ss" → minutos desde a meia-noite. */
export function minutesOfDay(time: string): number {
  const [h = "0", m = "0"] = time.split(":");
  return Number(h) * 60 + Number(m);
}

/** Dia da semana (0 = domingo) de uma data de calendário YYYY-MM-DD. */
export function weekdayOfDate(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

/** Soma dias a uma data de calendário YYYY-MM-DD. */
export function addDaysToDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Dias entre duas datas de calendário (to − from). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);
}

/** Fase de algo com início e fim (campanha, destaque) em relação a agora. */
export type Phase = "upcoming" | "live" | "ended";

export function phaseOf(now: Date, startsAt: Date, endsAt: Date): Phase {
  if (now < startsAt) return "upcoming";
  if (now >= endsAt) return "ended";
  return "live";
}

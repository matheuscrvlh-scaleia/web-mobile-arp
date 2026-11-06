import { minutesOfDay, toLocal } from "../../../shared/domain/time";

/** Um intervalo de um dia da semana (0 = domingo), "HH:mm". O dia pode ter vários. */
export interface DailyHours {
  weekday: number;
  opensAt: string;
  closesAt: string;
}

/** Intervalos por dia (ex.: almoço e jantar). */
export const HOURS_PER_DAY_MAX = 3;

/** Dois intervalos do mesmo dia se cruzam (o que passa da meia-noite vai até o fim do dia). */
export function hasOverlap(hours: readonly DailyHours[]): boolean {
  for (let day = 0; day < 7; day++) {
    const spans = hours
      .filter((h) => h.weekday === day)
      .map((h) => {
        const start = minutesOfDay(h.opensAt);
        const end = minutesOfDay(h.closesAt);
        return { start, end: end > start ? end : 24 * 60 };
      })
      .sort((a, b) => a.start - b.start);
    if (spans.some((s, i) => i > 0 && s.start < (spans[i - 1]?.end ?? 0))) return true;
  }
  return false;
}

/**
 * Aberto num dia da semana/minuto locais. Fechar antes (ou no mesmo
 * horário) de abrir significa que passa da meia-noite: 18:00–02:00 de
 * sexta vale para sexta à noite e para a madrugada de sábado.
 */
export function isOpenAt(
  hours: readonly DailyHours[],
  at: { weekday: number; minutes: number },
): boolean {
  return hours.some((h) => {
    const opens = minutesOfDay(h.opensAt);
    const closes = minutesOfDay(h.closesAt);
    if (closes > opens) {
      return h.weekday === at.weekday && at.minutes >= opens && at.minutes < closes;
    }
    const sameDay = h.weekday === at.weekday && at.minutes >= opens;
    const nextDay = (h.weekday + 1) % 7 === at.weekday && at.minutes < closes;
    return sameDay || nextDay;
  });
}

/** "Aberto agora" no fuso do negócio (America/Sao_Paulo). */
export function isOpenNow(hours: readonly DailyHours[], now: Date): boolean {
  const local = toLocal(now);
  return isOpenAt(hours, { weekday: local.weekday, minutes: local.hour * 60 + local.minute });
}

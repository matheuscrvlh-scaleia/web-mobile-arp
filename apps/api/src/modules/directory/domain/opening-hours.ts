import { minutesOfDay, toLocal } from "../../../shared/domain/time";

/** Horário de um dia da semana (0 = domingo), "HH:mm". */
export interface DailyHours {
  weekday: number;
  opensAt: string;
  closesAt: string;
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

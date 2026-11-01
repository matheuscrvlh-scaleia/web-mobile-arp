import { formatDateShort } from "@/shared/lib/format";

const DAY = 86_400_000;

export interface PeriodProgress {
  /** Dia atual dentro do período (0 = ainda não começou). */
  day: number;
  days: number;
  /** 0..1 */
  fraction: number;
}

/** Em que ponto do período a campanha está (para a barra do mês). */
export function periodProgress(startsAt: string, endsAt: string, now = Date.now()): PeriodProgress {
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  const days = Math.max(1, Math.ceil((end - start) / DAY));
  if (now < start) return { day: 0, days, fraction: 0 };
  if (now >= end) return { day: days, days, fraction: 1 };
  return {
    day: Math.floor((now - start) / DAY) + 1,
    days,
    fraction: (now - start) / (end - start),
  };
}

/** Dias que faltam até o fim (0 quando já acabou). */
export const daysLeft = (endsAt: string, now = Date.now()) =>
  Math.max(0, Math.ceil((new Date(endsAt).getTime() - now) / DAY));

/** "1 nov – 30 nov". */
export const formatPeriod = (startsAt: string, endsAt: string) =>
  `${formatDateShort(startsAt)} – ${formatDateShort(endsAt)}`;

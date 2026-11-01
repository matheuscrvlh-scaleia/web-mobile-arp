import type { EventRecurrence } from "@arp/contracts";
import { MONTH_LABEL, WEEKDAY_LABEL, WEEKDAY_SHORT, weekdayOfIso } from "@/shared/lib/dates";
import { formatIsoDay, formatTimeOfDay } from "@/shared/lib/format";

export interface WhenInput {
  recurrence: EventRecurrence;
  startsOn: string | null | undefined;
  endsOn?: string | null;
  weekday?: number | null;
  startTime?: string | null;
  endTime?: string | null;
  isLongRunning?: boolean;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;

/** "9h às 14h", "18h" ou "" (sem horário). */
export function describeTime(start?: string | null, end?: string | null): string {
  const s = start && TIME.test(start) ? formatTimeOfDay(start) : "";
  const e = end && TIME.test(end) ? formatTimeOfDay(end) : "";
  if (s && e) return `${s} às ${e}`;
  return s || (e ? `até ${e}` : "");
}

/** "Todo sábado" / "Toda segunda" (o dia da semana em pt-BR tem gênero). */
export function everyWeekday(weekday: number): string {
  const name = WEEKDAY_LABEL[weekday] ?? "";
  return `${weekday === 0 || weekday === 6 ? "Todo" : "Toda"} ${name.toLowerCase()}`;
}

function parts(iso: string) {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return { y, m, d };
}

function daysBetween(a: string, b: string): number {
  const pa = parts(a);
  const pb = parts(b);
  return Math.round((Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / 86_400_000);
}

/** "Sex, 31 de outubro". */
export function longDay(iso: string): string {
  const { m, d } = parts(iso);
  const wd = WEEKDAY_SHORT[weekdayOfIso(iso)] ?? "";
  return `${wd.charAt(0).toUpperCase()}${wd.slice(1)}, ${d} de ${MONTH_LABEL[m - 1]}`;
}

/** Só a parte das datas: "Todo sábado", "1 a 30 de novembro · todos os dias", "Sex, 31 de outubro". */
export function describeDays(v: WhenInput): string {
  const start = v.startsOn && ISO_DAY.test(v.startsOn) ? v.startsOn : null;
  const end = v.endsOn && ISO_DAY.test(v.endsOn) ? v.endsOn : null;
  if (v.recurrence === "weekly") {
    if (v.weekday == null) return "Toda semana";
    const extra = [start && `a partir de ${formatIsoDay(start)}`, end && `até ${formatIsoDay(end)}`]
      .filter(Boolean)
      .join(", ");
    return extra ? `${everyWeekday(v.weekday)} (${extra})` : everyWeekday(v.weekday);
  }
  if (!start) return "Data a definir";
  if (v.recurrence === "single" || !end || end === start) return longDay(start);
  const a = parts(start);
  const b = parts(end);
  const n = daysBetween(start, end) + 1;
  const span =
    a.y === b.y && a.m === b.m
      ? `${a.d} a ${b.d} de ${MONTH_LABEL[b.m - 1]}`
      : `${formatIsoDay(start)} a ${formatIsoDay(end)}`;
  return `${span} · ${v.isLongRunning ? "todos os dias" : `${n} dias`}`;
}

/** Resumo completo, como o app escreve: "Todo sábado · 9h às 14h". */
export function describeWhen(v: WhenInput): string {
  const time = describeTime(v.startTime, v.endTime);
  const days = describeDays(v);
  return time ? `${days} · ${time}` : days;
}

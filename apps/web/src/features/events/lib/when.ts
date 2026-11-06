import type { EventRecurrence } from "@arp/contracts";
import { MONTH_LABEL, WEEKDAY_LABEL, WEEKDAY_SHORT, weekdayOfIso } from "@/shared/lib/dates";
import { formatIsoDay, formatTimeOfDay } from "@/shared/lib/format";

export interface WhenInput {
  recurrence: EventRecurrence;
  startsOn: string | null | undefined;
  endsOn?: string | null;
  /** Legado (um dia só); `weekdays` tem prioridade. */
  weekday?: number | null;
  weekdays?: number[] | null;
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
  if (s && e) return `${s} às ${e}${end && start && end < start ? " (do dia seguinte)" : ""}`;
  return s || (e ? `até ${e}` : "");
}

/** "Todo sábado" / "Toda segunda" (o dia da semana em pt-BR tem gênero). */
export function everyWeekday(weekday: number): string {
  const name = WEEKDAY_LABEL[weekday] ?? "";
  return `${weekday === 0 || weekday === 6 ? "Todo" : "Toda"} ${name.toLowerCase()}`;
}

/** Segunda primeiro (como se fala), domingo por último. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

/** "Toda terça e quinta", "Todo sábado e domingo", "Toda semana" (os 7 dias: "Todos os dias"). */
export function everyWeekdays(days: readonly number[]): string {
  const sorted = WEEK_ORDER.filter((d) => days.includes(d));
  if (sorted.length === 0) return "Toda semana";
  if (sorted.length === 7) return "Todos os dias";
  const [first] = sorted as [number];
  if (sorted.length === 1) return everyWeekday(first);
  const names = sorted.map((d) => (WEEKDAY_LABEL[d] ?? "").toLowerCase());
  const list = `${names.slice(0, -1).join(", ")} e ${names.at(-1)}`;
  return `${first === 0 || first === 6 ? "Todo" : "Toda"} ${list}`;
}

/** Dias da semana de um evento (novo `weekdays` ou o legado `weekday`). */
export function weekdaysOf(v: Pick<WhenInput, "weekday" | "weekdays">): number[] {
  if (v.weekdays?.length) return v.weekdays;
  return v.weekday == null ? [] : [v.weekday];
}

/** Termina às 2h e começa às 22h: passa da meia-noite. */
export function crossesMidnight(start?: string | null, end?: string | null): boolean {
  return Boolean(start && end && TIME.test(start) && TIME.test(end) && end < start);
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
    const days = weekdaysOf(v);
    if (days.length === 0) return "Toda semana";
    const extra = [start && `a partir de ${formatIsoDay(start)}`, end && `até ${formatIsoDay(end)}`]
      .filter(Boolean)
      .join(", ");
    return extra ? `${everyWeekdays(days)} (${extra})` : everyWeekdays(days);
  }
  if (!start) return "Data a definir";
  // Fim antes do início: o erro aparece no campo; a prévia não mostra "-4 dias".
  if (v.recurrence === "single" || !end || end <= start) return longDay(start);
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

import { TIME_ZONE } from "./format";

// Datas no fuso do negócio (America/Sao_Paulo), independentes do fuso do
// navegador. O fio sempre leva ISO em UTC; os campos mostram a hora de SP.

const partsFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  weekday: "short",
});

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface ZonedParts {
  year: number;
  /** 1..12 */
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** 0 = domingo … 6 = sábado */
  weekday: number;
}

/** Partes da data/hora como aparecem num relógio de São Paulo. */
export function zonedParts(date: Date | string): ZonedParts {
  const d = typeof date === "string" ? new Date(date) : date;
  const map: Record<string, string> = {};
  for (const p of partsFmt.formatToParts(d)) map[p.type] = p.value;
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
    weekday: WEEKDAYS.indexOf(map.weekday ?? "Sun"),
  };
}

/** Diferença (ms) entre o relógio de SP e o UTC naquele instante (ex.: −3 h). */
function offsetAt(ms: number): number {
  const p = zonedParts(new Date(ms));
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(ms / 1000) * 1000;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** ISO (UTC) → valor de `<input type="datetime-local">` na hora de SP. */
export function toZonedInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const p = zonedParts(iso);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** Valor de `<input type="datetime-local">` (hora de SP) → ISO em UTC. */
export function fromZonedInput(local: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number) as [number, number, number, number, number, number];
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  // Duas passadas resolvem a virada de horário de verão (se um dia voltar).
  let ms = wall - offsetAt(wall);
  ms = wall - offsetAt(ms);
  return new Date(ms).toISOString();
}

/** Hoje em SP no formato de calendário "2026-10-31". */
export function todayIso(now: Date = new Date()): string {
  const p = zonedParts(now);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Dia de calendário (ISO) somado de n dias. */
export function addDaysIso(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d + n));
  return date.toISOString().slice(0, 10);
}

/** Dia da semana (0 = domingo) de uma data de calendário. */
export function weekdayOfIso(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Primeiro e último dia do mês ("2026-10" → ["2026-10-01", "2026-10-31"]). */
export function monthBounds(month: string): [string, string] {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return [`${y}-${pad(m)}-01`, `${y}-${pad(m)}-${pad(last)}`];
}

/** Mês atual em SP ("2026-10"). */
export const currentMonth = (now: Date = new Date()) => todayIso(now).slice(0, 7);

/** "2026-10" somado de n meses. */
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}

/** ISO somado de h horas. */
export const addHours = (iso: string, h: number) =>
  new Date(new Date(iso).getTime() + h * 3_600_000).toISOString();

/** Agora arredondado para o próximo múltiplo de `step` minutos (padrão dos formulários). */
export function nextRoundedNow(step = 15, now: Date = new Date()): string {
  const ms = step * 60_000;
  return new Date(Math.ceil(now.getTime() / ms) * ms).toISOString();
}

export const WEEKDAY_LABEL = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
] as const;
export const WEEKDAY_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"] as const;
export const MONTH_LABEL = [
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
] as const;

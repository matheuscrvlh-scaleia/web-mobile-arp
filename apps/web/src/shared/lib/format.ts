// Formatadores pt-BR. Datas sempre no fuso do negócio (America/Sao_Paulo),
// não no do navegador: o lojista em viagem vê o mesmo horário que o caixa.

export const TIME_ZONE = "America/Sao_Paulo";

const numberFmt = new Intl.NumberFormat("pt-BR");
const currencyFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const currencyFmt0 = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});
const dateFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const dateShortFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "short",
});
const dateTimeFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const timeFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
});
const todayFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TIME_ZONE,
  weekday: "short",
  day: "2-digit",
  month: "short",
});
const relativeFmt = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

const toDate = (v: Date | string) => (typeof v === "string" ? new Date(v) : v);

export function formatNumber(v: number, decimals = 0): string {
  if (decimals === 0) return numberFmt.format(Math.round(v));
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(v);
}

/** Centavos → "R$ 12,50". Com `whole`, sem os centavos ("R$ 13"). */
export function formatCents(cents: number, { whole = false } = {}): string {
  const v = cents / 100;
  return (whole ? currencyFmt0 : currencyFmt).format(v).replace(/ /g, " ");
}

/** Fração 0..1 → "42%" (uma casa abaixo de 10%). */
export function formatPercent(fraction: number): string {
  const p = fraction * 100;
  return `${formatNumber(p, p > 0 && p < 10 ? 1 : 0)}%`;
}

export const formatDate = (v: Date | string) => dateFmt.format(toDate(v));
export const formatDateShort = (v: Date | string) =>
  dateShortFmt.format(toDate(v)).replace(/\./g, "");
export const formatDateTime = (v: Date | string) =>
  dateTimeFmt.format(toDate(v)).replace(",", " às");
export const formatTime = (v: Date | string) => timeFmt.format(toDate(v));
/** "sex., 31 de out." → "sex, 31 out" (barra superior). */
export const formatToday = (v: Date = new Date()) =>
  todayFmt.format(v).replace(/\./g, "").replace(/ de /g, " ");

/** Data de calendário "2026-10-31" (sem fuso) → "31/10". */
export function formatIsoDay(iso: string, { withYear = false } = {}): string {
  const [y, m, d] = iso.split("-");
  return withYear ? `${d}/${m}/${y}` : `${d}/${m}`;
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

/** "há 3 min", "em 2 dias", "agora". */
export function formatRelative(v: Date | string, now: Date = new Date()): string {
  const diff = (toDate(v).getTime() - now.getTime()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 45) return "agora";
  for (const [unit, secs] of UNITS) {
    if (abs >= secs || unit === "minute") {
      return relativeFmt
        .format(Math.round(diff / secs), unit)
        .replace(" minutos", " min")
        .replace(" minuto", " min");
    }
  }
  return "agora";
}

/** Hora do dia em número → "19h". */
export const formatHour = (h: number) => `${h}h`;

/** "Ana Paula Souza" → "AS". */
export function initials(name: string): string {
  // Só palavras que começam com letra ou número ("[R2] Bia Lima" → "BL", não "[L").
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((p) => /^[\p{L}\p{N}]/u.test(p));
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return `${first}${last}`.toUpperCase();
}

/** "1 loja" / "3 lojas". */
export function plural(n: number, one: string, many: string): string {
  return `${formatNumber(n)} ${n === 1 ? one : many}`;
}

export interface Delta {
  text: string;
  direction: "up" | "down" | "flat";
}

/**
 * Variação entre o valor do período e o anterior. `kind: "points"` para
 * taxas (0..1): mostra a diferença em pontos percentuais.
 */
export function formatDelta(
  value: number,
  previous: number | null,
  kind: "relative" | "points" = "relative",
): Delta | null {
  if (previous === null) return null;
  if (kind === "points") {
    const pp = (value - previous) * 100;
    const direction = Math.abs(pp) < 0.05 ? "flat" : pp > 0 ? "up" : "down";
    const sign = pp > 0 ? "+" : pp < 0 ? "−" : "";
    return { text: `${sign}${formatNumber(Math.abs(pp), 1)} p.p.`, direction };
  }
  if (previous === 0) {
    if (value === 0) return { text: "sem variação", direction: "flat" };
    return { text: "novo no período", direction: "up" };
  }
  const pct = ((value - previous) / Math.abs(previous)) * 100;
  const direction = Math.abs(pct) < 0.5 ? "flat" : pct > 0 ? "up" : "down";
  if (direction === "flat") return { text: "sem variação", direction };
  const sign = pct > 0 ? "+" : "−";
  const abs = Math.abs(pct);
  return { text: `${sign}${formatNumber(abs, abs < 10 ? 1 : 0)}%`, direction };
}

/** Tempo restante em "HH:MM:SS" (com dias na frente quando passa de 24 h: "2d 03:10:00"). */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const total = Math.floor(ms / 1000);
  const days = Math.floor(total / 86_400);
  const p2 = (n: number) => String(n).padStart(2, "0");
  const hms = `${p2(Math.floor((total % 86_400) / 3600))}:${p2(Math.floor((total % 3600) / 60))}:${p2(total % 60)}`;
  return days > 0 ? `${days}d ${hms}` : hms;
}

/** Hora do dia "09:00" → "9h"; "14:30" → "14h30" (como o app escreve). */
export function formatTimeOfDay(hhmm: string): string {
  const [h = "0", m = "00"] = hhmm.split(":");
  return `${Number(h)}h${m === "00" ? "" : m}`;
}

/** Prazo em horas → "24 horas", "2 dias", "1 dia e 12 horas". */
export function formatHours(hours: number): string {
  if (hours < 24 || hours % 24 !== 0) {
    if (hours < 48) return plural(hours, "hora", "horas");
    const d = Math.floor(hours / 24);
    return `${plural(d, "dia", "dias")} e ${plural(hours % 24, "hora", "horas")}`;
  }
  return plural(hours / 24, "dia", "dias");
}

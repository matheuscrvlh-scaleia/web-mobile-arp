import type { Campaign, Challenge, QrCode } from "@arp/contracts";
import { formatDateTime, TIME_ZONE } from "@/shared/lib/format";

export type QrState =
  | "active"
  | "scheduled"
  | "expired"
  | "revoked"
  /** Desafio pausado: o scan dá "inválido". */
  | "paused"
  /** Campanha arquivada: fora do app. */
  | "unpublished"
  /** Campanha em rascunho: passa a valer quando for publicada. */
  | "awaiting"
  /** Campanha (ou janela do desafio) ainda não começou. */
  | "waiting"
  /** Campanha (ou janela do desafio) já acabou. */
  | "ended";

/** O que o QR precisa saber da campanha e do desafio para dizer se dá selo agora. */
export interface QrContext {
  campaign?: Pick<Campaign, "status" | "startsAt" | "endsAt">;
  challenge?: Pick<Challenge, "status" | "availableFrom" | "availableUntil">;
}

const t = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() : null);

/**
 * Período em que o desafio dá selo: o da campanha, cortado pela janela
 * própria do desafio (quando tem).
 */
export function challengePeriod(ctx: Required<QrContext>): { start: number; end: number } {
  const { campaign, challenge } = ctx;
  return {
    start: Math.max(t(campaign.startsAt) ?? 0, t(challenge.availableFrom) ?? 0),
    end: Math.min(
      t(campaign.endsAt) ?? Number.POSITIVE_INFINITY,
      t(challenge.availableUntil) ?? Number.POSITIVE_INFINITY,
    ),
  };
}

/**
 * Situação real do QR agora, como o app vai responder no scan: o próprio QR
 * (revogado, prazo) e, quando informados, o desafio (pausado, janela) e a
 * campanha (publicada, período).
 */
export function qrState(qr: QrCode, ctx: QrContext = {}, now = Date.now()): QrState {
  if (qr.status === "revoked") return "revoked";
  const until = t(qr.validUntil);
  if (!qr.rotating && until !== null && until <= now) return "expired";
  if (ctx.challenge?.status === "inactive") return "paused";
  if (ctx.campaign && ctx.campaign.status !== "published")
    return ctx.campaign.status === "draft" ? "awaiting" : "unpublished";
  if (ctx.campaign && ctx.challenge) {
    const { start, end } = challengePeriod({ campaign: ctx.campaign, challenge: ctx.challenge });
    if (now >= end) return "ended";
    if (now < start) return "waiting";
  }
  const from = t(qr.validFrom);
  if (from !== null && from > now) return "scheduled";
  return "active";
}

/**
 * Quanto do período do desafio o QR fixo cobre: "before" = vence antes de
 * o desafio começar; "partial" = vence no meio; "ok" = cobre até o fim.
 */
export function qrCoverage(
  qr: { validFrom: string | null; validUntil: string | null; rotating: boolean },
  period: { start: number; end: number },
): "before" | "partial" | "ok" {
  const until = t(qr.validUntil);
  if (qr.rotating || until === null) return "ok";
  if (until <= period.start) return "before";
  if (until < period.end) return "partial";
  return "ok";
}

const TTL_TEXT: Record<number, string> = {
  45: "45 segundos",
  300: "5 minutos",
  3600: "1 hora",
  86400: "24 horas",
  259200: "3 dias",
  604800: "7 dias",
};

/** Prazo em texto ("5 minutos"). */
export function ttlText(seconds: number): string {
  return TTL_TEXT[seconds] ?? `${Math.round(seconds / 60)} min`;
}

/** Validade em texto. Telão: o código muda a cada prazo. */
export function qrWindowText(
  qr: Pick<QrCode, "validFrom" | "validUntil" | "rotating" | "ttlSeconds">,
): string {
  const { validFrom, validUntil } = qr;
  if (qr.rotating) {
    const every = `Telão: muda a cada ${ttlText(qr.ttlSeconds)}`;
    return validFrom ? `${every}, a partir de ${formatDateTime(validFrom)}` : every;
  }
  if (validFrom && validUntil)
    return `De ${formatDateTime(validFrom)} até ${formatDateTime(validUntil)}`;
  if (validFrom) return `A partir de ${formatDateTime(validFrom)}`;
  if (validUntil) return `Até ${formatDateTime(validUntil)}`;
  return "Sempre (enquanto a campanha estiver no ar)";
}

const dayMonth = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  timeZone: TIME_ZONE,
});
const hourMinute = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TIME_ZONE,
});

/** "08/12" (horário de Brasília). */
export const formatDayMonth = (ms: number) => dayMonth.format(ms);

/**
 * Validade do QR fixo para o cartaz: "Vale de 01/12 a 07/12". Vencer à
 * meia-noite conta como o dia anterior inteiro; em outro horário, diz a hora.
 * Telão ou sem prazo: null.
 */
export function qrValidityRange(
  qr: Pick<QrCode, "validFrom" | "validUntil" | "rotating" | "createdAt">,
): { text: string; swapOn: string } | null {
  if (qr.rotating || !qr.validUntil) return null;
  const from = new Date(qr.validFrom ?? qr.createdAt).getTime();
  const until = new Date(qr.validUntil).getTime();
  const midnight = hourMinute.format(until) === "00:00";
  const to = midnight
    ? formatDayMonth(until - 1)
    : `${formatDayMonth(until)} às ${hourMinute.format(until)}`;
  return { text: `Vale de ${formatDayMonth(from)} a ${to}`, swapOn: formatDayMonth(until) };
}

const WEEK_MS = 7 * 86_400_000;
/** Cartazes por desafio de uma vez (um mês e pouco). */
export const MAX_WEEKS = 6;

export interface QrWeek {
  /** 1 = primeira semana do período. */
  week: number;
  from: number;
  until: number;
}

/**
 * Semanas do período do desafio, a partir do início dele (01/12, 08/12…),
 * cada uma com um QR de no máximo 7 dias (limite antifraude da API). Pula
 * as que já acabaram e para em MAX_WEEKS; a última termina com o período.
 */
export function weeklyWindows(
  period: { start: number; end: number },
  now = Date.now(),
): { weeks: QrWeek[]; coversEnd: boolean } {
  const weeks: QrWeek[] = [];
  if (!Number.isFinite(period.end)) return { weeks, coversEnd: false };
  let from = period.start;
  for (let week = 1; from < period.end && weeks.length < MAX_WEEKS; week++, from += WEEK_MS) {
    const until = Math.min(from + WEEK_MS, period.end);
    // Mínimo da API (15 s) e semana que já passou ficam de fora.
    if (until <= now || until - from < 60_000) continue;
    weeks.push({ week, from, until });
  }
  const last = weeks.at(-1);
  return { weeks, coversEnd: last ? last.until >= period.end : false };
}

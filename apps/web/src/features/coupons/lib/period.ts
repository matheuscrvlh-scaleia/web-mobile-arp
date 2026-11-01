import type { Coupon } from "@arp/contracts";
import { formatDateShort, formatDateTime } from "@/shared/lib/format";

/** Quando a promoção vale, em uma linha curta ("começa 03 nov", "até 30 nov", "sem data para acabar"). */
export function couponPeriodShort(
  c: Pick<Coupon, "startsAt" | "endsAt">,
  now = Date.now(),
): string {
  if (new Date(c.startsAt).getTime() > now) return `Começa ${formatDateShort(c.startsAt)}`;
  if (c.endsAt) {
    return new Date(c.endsAt).getTime() < now
      ? `Terminou ${formatDateShort(c.endsAt)}`
      : `Até ${formatDateShort(c.endsAt)}`;
  }
  return "Sem data para acabar";
}

/** Período completo ("01/11/2026 às 10:00 → 30/11/2026 às 22:00"). */
export function couponPeriodLong(c: Pick<Coupon, "startsAt" | "endsAt">): string {
  return c.endsAt
    ? `${formatDateTime(c.startsAt)} → ${formatDateTime(c.endsAt)}`
    : `A partir de ${formatDateTime(c.startsAt)} (sem data para acabar)`;
}

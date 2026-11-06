import type { CouponClaim } from "@arp/contracts";
import { zonedParts } from "@/shared/lib/dates";

/** O cupom não vale hoje (dia da semana em São Paulo fora dos dias escolhidos)? */
export function invalidToday(claim: CouponClaim, now: Date = new Date()): boolean {
  const days = claim.coupon.weekdays;
  if (!days || days.length === 0 || days.length === 7) return false;
  return !days.includes(zonedParts(now).weekday);
}

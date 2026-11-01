import { COUPON_CODE_PATTERN } from "@arp/contracts";

export const CODE_PREFIX = "ARP-";
export const CODE_BODY_LENGTH = 6;

/**
 * O que a pessoa digitou ou colou → as 6 letras/números depois de "ARP-".
 * Aceita "arp-ab12cd", "ARP AB12CD", "ab12cd" e o código com espaços ou
 * traços no meio. Maiúsculas sempre.
 */
export function normalizeCodeBody(text: string): string {
  const raw = text.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const body = raw.length > CODE_BODY_LENGTH && raw.startsWith("ARP") ? raw.slice(3) : raw;
  return body.slice(0, CODE_BODY_LENGTH);
}

export const fullCode = (body: string) => `${CODE_PREFIX}${body}`;
export const isCompleteCode = (body: string) => COUPON_CODE_PATTERN.test(fullCode(body));

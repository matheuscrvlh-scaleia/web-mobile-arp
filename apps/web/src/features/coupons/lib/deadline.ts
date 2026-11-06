import type { Coupon } from "@arp/contracts";
import { formatDateShort, formatDateTime, formatHours } from "@/shared/lib/format";

/**
 * "Até quando o visitante pode usar?" (uma pergunta só no formulário):
 * - hours: X horas depois de pegar (useUntil vazio);
 * - date:  até uma data fixa (useUntil);
 * - end:   até o fim da promoção (useUntil = endsAt e vence junto com ela).
 */
export type DeadlineMode = "hours" | "date" | "end";

type DeadlineFields = Pick<Coupon, "useUntil" | "endsAt" | "expiresWithPromotion">;

const sameInstant = (a: string, b: string) => new Date(a).getTime() === new Date(b).getTime();

export function deadlineModeOf(c: DeadlineFields): DeadlineMode {
  if (!c.useUntil) return "hours";
  return c.expiresWithPromotion && c.endsAt && sameInstant(c.useUntil, c.endsAt) ? "end" : "date";
}

/** Curto, para tabela e cartão: "24 h", "até 30 nov", "até o fim (30 nov)". */
export function deadlineShort(c: DeadlineFields & Pick<Coupon, "redeemWindowHours">): string {
  switch (deadlineModeOf(c)) {
    case "hours":
      return `${c.redeemWindowHours} h`;
    case "date":
      return `até ${formatDateShort(c.useUntil ?? "")}`;
    case "end":
      return `até o fim (${formatDateShort(c.endsAt ?? "")})`;
  }
}

/** Frase da regra (detalhe e prévia). */
export function deadlineRule(c: DeadlineFields & Pick<Coupon, "redeemWindowHours">): {
  title: string;
  text: string;
} {
  switch (deadlineModeOf(c)) {
    case "hours":
      return {
        title: `${formatHours(c.redeemWindowHours)} para usar`,
        text:
          c.expiresWithPromotion && c.endsAt
            ? `Conta de quando o visitante pega o cupom e para no fim da promoção (${formatDateTime(c.endsAt)}).`
            : "Conta de quando o visitante pega o cupom.",
      };
    case "date":
      return {
        title: `Usar até ${formatDateTime(c.useUntil ?? "")}`,
        text: "Quem pegar usa até essa data, não importa quando pegou. Depois dela, ninguém pega mais.",
      };
    case "end":
      return {
        title: "Usar até o fim da promoção",
        text: `Quem pegar usa até ${formatDateTime(c.endsAt ?? "")}, quando a promoção termina.`,
      };
  }
}

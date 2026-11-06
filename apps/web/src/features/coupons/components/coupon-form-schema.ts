import {
  COUPON_BULK_MAX_STORES,
  type Coupon,
  type CreateCouponBody,
  createCouponBodySchema,
  type UpdateCouponBody,
} from "@arp/contracts";
import { z } from "zod";
import { formatDateTime } from "@/shared/lib/format";
import { type DeadlineMode, deadlineModeOf } from "../lib/deadline";

// Formulário da promoção: os campos do contrato (createCouponBodySchema),
// com mensagens em pt-BR nos que a pessoa mais erra, a economia digitada em
// reais (vira savingsCents ao enviar), várias lojas de uma vez (uma promoção
// por loja) e a pergunta única "Até quando o visitante pode usar?" (deadline),
// que vira redeemWindowHours/useUntil/expiresWithPromotion ao enviar.

const {
  savingsCents: _savingsCents,
  storeId: _storeId,
  redeemWindowHours: _hours,
  ...base
} = createCouponBodySchema.shape;

/** "12,50", "12.50", "R$ 1.234,56" → centavos; inválido → null. */
export function parseReais(text: string): number | null {
  let t = text.replace(/R\$/gi, "").replace(/\s/g, "");
  if (!t) return null;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(Number(t) * 100);
}

/** Centavos → texto do campo ("12,50"). */
export const centsToInput = (cents: number | null | undefined) =>
  cents == null ? "" : (cents / 100).toFixed(2).replace(".", ",");

const validHours = (h: unknown): h is number =>
  typeof h === "number" && Number.isInteger(h) && h >= 1 && h <= 720;

export const couponFormSchema = z
  .object({
    ...base,
    storeIds: z
      .array(z.uuid())
      .min(1, "Escolha a loja")
      .max(COUPON_BULK_MAX_STORES, `No máximo ${COUPON_BULK_MAX_STORES} lojas por vez`),
    title: z
      .string()
      .trim()
      .min(3, "Escreva um título (3 letras ou mais)")
      .max(120, "No máximo 120 caracteres"),
    headline: z
      .string()
      .trim()
      .min(1, "Escreva o destaque (ex.: R$ 5, 15%, Grátis)")
      .max(16, "No máximo 16 caracteres"),
    startsAt: z.string({ error: "Informe quando começa" }).pipe(base.startsAt),
    totalQuantity: z
      .number({ error: "Informe quantos cupons liberar" })
      .int("Use um número inteiro")
      .min(1, "Libere pelo menos 1 cupom")
      .max(100_000, "No máximo 100.000"),
    deadline: z.enum(["hours", "date", "end"]),
    // Só conta (e só é conferido) em "X horas depois de pegar".
    redeemWindowHours: z.number().or(z.nan()),
    savings: z
      .string()
      .trim()
      .refine((v) => v === "" || parseReais(v) !== null, "Use um valor em reais (ex.: 12,50)"),
  })
  .superRefine((v, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: "custom", path: [path], message });
    const starts = new Date(v.startsAt).getTime();
    if (v.endsAt && new Date(v.endsAt).getTime() <= starts) {
      issue("endsAt", "O fim precisa ser depois do início");
    }
    if (v.deadline === "hours") {
      const h = v.redeemWindowHours;
      if (!Number.isFinite(h)) issue("redeemWindowHours", "Informe o prazo em horas");
      else if (!Number.isInteger(h)) issue("redeemWindowHours", "Use horas inteiras");
      else if (h < 1) issue("redeemWindowHours", "Pelo menos 1 hora");
      else if (h > 720) issue("redeemWindowHours", "No máximo 720 horas (30 dias)");
    }
    if (v.deadline === "date") {
      if (!v.useUntil) {
        issue("useUntil", "Escolha a data em que o cupom vence");
        return;
      }
      const until = new Date(v.useUntil).getTime();
      if (until <= starts) issue("useUntil", "Precisa ser depois do início da promoção");
      // Antes do fim, ninguém conseguiria pegar depois desta data: a promoção acabaria antes.
      else if (v.endsAt && until < new Date(v.endsAt).getTime()) {
        issue(
          "useUntil",
          `É antes do fim da promoção (${formatDateTime(v.endsAt)}): depois desta data ninguém pega mais. Use uma data igual ou depois do fim, ou escolha “até o fim da promoção”.`,
        );
      }
    }
    if (v.deadline === "end" && !v.endsAt) {
      issue("endsAt", "Escolha quando a promoção termina (o cupom vale até lá)");
    }
  });

export type CouponFormInput = z.input<typeof couponFormSchema>;
export type CouponFormValues = z.output<typeof couponFormSchema>;

/** Campos do formulário (para levar os erros da API ao campo certo). */
export const COUPON_FORM_FIELDS = [
  ...Object.keys(base),
  "storeIds",
  "redeemWindowHours",
  "savings",
  "deadline",
];
/** O nome do campo na API → no formulário. */
export const COUPON_FIELD_MAP: Record<string, string> = {
  savingsCents: "savings",
  storeId: "storeIds",
  expiresWithPromotion: "deadline",
};

/**
 * Valores iniciais: de uma promoção salva (editar), de uma cópia (duplicar:
 * título "(cópia)", rascunho e datas a revisar) ou em branco (criar).
 */
export function couponToFormValues(
  coupon: Coupon | undefined,
  defaults: { storeId: string; startsAt: string; redeemWindowHours: number },
  copy = false,
): CouponFormInput {
  const deadline: DeadlineMode = coupon ? deadlineModeOf(coupon) : "hours";
  // Cópia: datas que já passaram voltam para o padrão (a pessoa revisa).
  const past = (iso: string | null | undefined) =>
    copy && iso ? new Date(iso).getTime() <= Date.now() : false;
  return {
    storeIds: coupon ? [coupon.store.id] : defaults.storeId ? [defaults.storeId] : [],
    title: coupon ? (copy ? `${coupon.title} (cópia)`.slice(0, 120) : coupon.title) : "",
    headline: coupon?.headline ?? "",
    headlineSub: coupon?.headlineSub ?? null,
    description: coupon?.description ?? null,
    scheduleNote: coupon?.scheduleNote ?? null,
    startsAt: coupon && !past(coupon.startsAt) ? coupon.startsAt : defaults.startsAt,
    endsAt: coupon && !past(coupon.endsAt) ? coupon.endsAt : null,
    totalQuantity: coupon?.totalQuantity ?? 20,
    redeemWindowHours: coupon?.redeemWindowHours ?? defaults.redeemWindowHours,
    deadline: copy && deadline !== "hours" && past(coupon?.useUntil) ? "hours" : deadline,
    tone: coupon?.tone ?? "green",
    icon: coupon?.icon ?? "ticket-percent",
    imageUrl: coupon?.imageUrl ?? null,
    status: "draft",
    weekdays: coupon?.weekdays ?? [0, 1, 2, 3, 4, 5, 6],
    expiresWithPromotion: coupon?.expiresWithPromotion ?? false,
    useUntil: coupon && !past(coupon.useUntil) ? coupon.useUntil : null,
    savings: centsToInput(coupon?.savingsCents),
  };
}

/** A pergunta única de prazo → os três campos que a API guarda. */
export function deadlineFields(
  v: Pick<
    CouponFormValues,
    "deadline" | "redeemWindowHours" | "useUntil" | "endsAt" | "expiresWithPromotion"
  >,
  fallbackHours: number,
): Pick<CreateCouponBody, "redeemWindowHours" | "useUntil" | "expiresWithPromotion"> {
  const hours = validHours(v.redeemWindowHours) ? v.redeemWindowHours : fallbackHours;
  switch (v.deadline) {
    case "hours":
      // Legado: "para no fim da promoção" continua como estava (não aparece mais no form).
      return {
        redeemWindowHours: hours,
        useUntil: null,
        expiresWithPromotion: v.expiresWithPromotion,
      };
    case "date":
      return {
        redeemWindowHours: hours,
        useUntil: v.useUntil ?? null,
        expiresWithPromotion: false,
      };
    case "end":
      return { redeemWindowHours: hours, useUntil: v.endsAt ?? null, expiresWithPromotion: true };
  }
}

/** Corpo do POST (sem a loja: quem chama manda storeId ou storeIds). */
export function toCreateFields(
  values: CouponFormValues,
  fallbackHours: number,
): Omit<CreateCouponBody, "storeId"> {
  const {
    savings,
    storeIds: _stores,
    deadline: _deadline,
    redeemWindowHours: _h,
    useUntil: _u,
    expiresWithPromotion: _e,
    ...rest
  } = values;
  return {
    ...rest,
    ...deadlineFields(values, fallbackHours),
    savingsCents: savings === "" ? null : parseReais(savings),
  };
}

/**
 * PATCH só do que mudou (loja e situação não se editam por aqui). O prazo
 * entra quando o resultado da pergunta difere do que está salvo.
 */
export function toUpdateBody(
  values: CouponFormValues,
  dirty: Partial<Record<keyof CouponFormInput, unknown>>,
  coupon: Coupon,
): UpdateCouponBody {
  const body: UpdateCouponBody = {};
  const {
    savings,
    storeIds: _stores,
    status: _status,
    deadline: _deadline,
    redeemWindowHours: _h,
    useUntil: _u,
    expiresWithPromotion: _e,
    ...rest
  } = values;
  for (const key of Object.keys(rest) as (keyof typeof rest)[]) {
    if (dirty[key]) Object.assign(body, { [key]: rest[key] });
  }
  if (dirty.savings) body.savingsCents = savings === "" ? null : parseReais(savings);
  const next = deadlineFields(values, coupon.redeemWindowHours);
  const sameDate = (a: string | null | undefined, b: string | null) =>
    (a ?? null) === b || (a && b ? new Date(a).getTime() === new Date(b).getTime() : false);
  if (next.redeemWindowHours !== coupon.redeemWindowHours)
    body.redeemWindowHours = next.redeemWindowHours;
  if (!sameDate(next.useUntil, coupon.useUntil)) body.useUntil = next.useUntil ?? null;
  if (next.expiresWithPromotion !== coupon.expiresWithPromotion)
    body.expiresWithPromotion = next.expiresWithPromotion;
  return body;
}

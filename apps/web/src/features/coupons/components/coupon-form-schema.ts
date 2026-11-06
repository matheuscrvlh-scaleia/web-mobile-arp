import {
  type Coupon,
  type CreateCouponBody,
  createCouponBodySchema,
  type UpdateCouponBody,
} from "@arp/contracts";
import { z } from "zod";

// Formulário da promoção: os campos do contrato (createCouponBodySchema),
// com mensagens em pt-BR nos que a pessoa mais erra e a economia digitada
// em reais (vira savingsCents ao enviar).

const { savingsCents: _savingsCents, ...base } = createCouponBodySchema.shape;

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

export const couponFormSchema = z
  .object({
    ...base,
    storeId: z.uuid("Escolha a loja"),
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
    redeemWindowHours: z
      .number({ error: "Informe o prazo em horas" })
      .int("Use horas inteiras")
      .min(1, "Pelo menos 1 hora")
      .max(720, "No máximo 720 horas (30 dias)"),
    savings: z
      .string()
      .trim()
      .refine((v) => v === "" || parseReais(v) !== null, "Use um valor em reais (ex.: 12,50)"),
  })
  .refine((v) => !v.endsAt || new Date(v.endsAt) > new Date(v.startsAt), {
    message: "O fim precisa ser depois do início",
    path: ["endsAt"],
  })
  .refine((v) => !v.useUntil || new Date(v.useUntil) > new Date(v.startsAt), {
    message: "A data de vencimento precisa ser depois do início",
    path: ["useUntil"],
  });

export type CouponFormInput = z.input<typeof couponFormSchema>;
export type CouponFormValues = z.output<typeof couponFormSchema>;

/** Campos do formulário (para levar os erros da API ao campo certo). */
export const COUPON_FORM_FIELDS = [...Object.keys(base), "savings"];
/** O nome do campo na API → no formulário. */
export const COUPON_FIELD_MAP: Record<string, string> = { savingsCents: "savings" };

export function couponToFormValues(
  coupon: Coupon | undefined,
  defaults: { storeId: string; startsAt: string; redeemWindowHours: number },
): CouponFormInput {
  return {
    storeId: coupon?.store.id ?? defaults.storeId,
    title: coupon?.title ?? "",
    headline: coupon?.headline ?? "",
    headlineSub: coupon?.headlineSub ?? null,
    description: coupon?.description ?? null,
    scheduleNote: coupon?.scheduleNote ?? null,
    startsAt: coupon?.startsAt ?? defaults.startsAt,
    endsAt: coupon?.endsAt ?? null,
    totalQuantity: coupon?.totalQuantity ?? 20,
    redeemWindowHours: coupon?.redeemWindowHours ?? defaults.redeemWindowHours,
    tone: coupon?.tone ?? "green",
    icon: coupon?.icon ?? "ticket-percent",
    imageUrl: coupon?.imageUrl ?? null,
    status: "draft",
    weekdays: coupon?.weekdays ?? [0, 1, 2, 3, 4, 5, 6],
    expiresWithPromotion: coupon?.expiresWithPromotion ?? false,
    useUntil: coupon?.useUntil ?? null,
    savings: centsToInput(coupon?.savingsCents),
  };
}

export function toCreateBody(values: CouponFormValues): CreateCouponBody {
  const { savings, ...rest } = values;
  return { ...rest, savingsCents: savings === "" ? null : parseReais(savings) };
}

/** PATCH só do que mudou (loja e situação não se editam por aqui). */
export function toUpdateBody(
  values: CouponFormValues,
  dirty: Partial<Record<keyof CouponFormInput, unknown>>,
): UpdateCouponBody {
  const body: UpdateCouponBody = {};
  const { savings, storeId: _store, status: _status, ...rest } = values;
  for (const key of Object.keys(rest) as (keyof typeof rest)[]) {
    if (dirty[key]) Object.assign(body, { [key]: rest[key] });
  }
  if (dirty.savings) body.savingsCents = savings === "" ? null : parseReais(savings);
  return body;
}

import { z } from "zod";

/* Primitivos ------------------------------------------------------------- */

export const idSchema = z.uuid();
export const idParamsSchema = z.object({ id: z.uuid() });
export type IdParams = z.infer<typeof idParamsSchema>;

/** Data e hora ISO 8601 em UTC (ex.: 2026-10-31T21:00:00.000Z). Sempre string no fio. */
export const isoDateTimeSchema = z.iso.datetime({ offset: true });
/** Data de calendário (ex.: 2026-10-31), sem fuso. */
export const isoDateSchema = z.iso.date();
/** Hora do dia "HH:mm" (24h). */
export const timeOfDaySchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use o formato HH:mm");
export const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use uma cor no formato #RRGGBB");
/** Nome de ícone do lucide em kebab-case (ex.: "ticket-percent"). */
export const iconNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .regex(/^[a-z0-9-]+$/);
export const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use letras minúsculas, números e hífens");
/** Valor em centavos (inteiro). */
export const centsSchema = z.number().int().min(0);
/** Só http(s): `z.url()` sozinho aceita `javascript:` e outros esquemas. */
export const urlSchema = z.url({ protocol: /^https?$/, error: "Use um link http(s)" }).max(2048);
/** URL absoluta http(s) ou caminho servido pela API (ex.: /uploads/2026/10/abc.webp). */
export const mediaUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .refine((v) => /^\/(?!\/)/.test(v) || /^https?:\/\//.test(v), "URL de imagem inválida");

export const nullableText = (max: number) => z.string().trim().max(max).nullable();
export const optionalNullableText = (max: number) => nullableText(max).optional();

type PatchShape<T extends z.ZodRawShape> = {
  [K in keyof T]: z.ZodOptional<T[K] extends z.ZodDefault<infer I extends z.ZodType> ? I : T[K]>;
};

/**
 * Campos de um PATCH: todos opcionais e **sem os defaults** do create. No
 * Zod 4 o `.default()` continua valendo dentro de `.partial()`, então um
 * PATCH de um campo só sobrescreveria os outros com o valor padrão.
 */
export function patchOf<T extends z.ZodRawShape>(shape: T): PatchShape<T> {
  const out: Record<string, z.ZodType> = {};
  for (const [key, schema] of Object.entries(shape) as [string, z.ZodType][]) {
    const inner = schema instanceof z.ZodDefault ? (schema.unwrap() as z.ZodType) : schema;
    out[key] = inner.optional();
  }
  return out as PatchShape<T>;
}

/** Referência curta a outra entidade (id + nome), usada nas respostas. */
export const refSchema = z.object({ id: idSchema, name: z.string() });

/**
 * true = dado fictício de demonstração (is_demo, gravado direto no banco): o
 * painel mostra um ícone. Ausente ou false = dado real.
 */
export const demoFlagSchema = z.boolean().optional();
export type Ref = z.infer<typeof refSchema>;

/* Paginação -------------------------------------------------------------- */

export const PAGE_SIZE_MAX = 100;

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(PAGE_SIZE_MAX).default(20),
  /** Busca livre (nome, título, e-mail…), sem diferenciar acentos e maiúsculas. */
  q: z.string().trim().max(120).optional(),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

/**
 * Paginação por cursor (keyset), opcional nas listas que crescem sem parar.
 * Com `cursor`, `page` é ignorado e a página não traz total (meta.total = -1):
 * custo constante em qualquer profundidade. Sem cursor, segue por página.
 */
export const cursorQuerySchema = z.object({
  cursor: z
    .string()
    .trim()
    .max(200)
    .regex(/^[A-Za-z0-9_-]+$/, "Cursor inválido")
    .optional(),
});

export const pageMetaSchema = z.object({
  page: z.number().int(),
  pageSize: z.number().int(),
  /** -1 quando a página veio por cursor (keyset): a contagem é pulada de propósito. */
  total: z.number().int(),
  /** -1 quando a página veio por cursor (keyset). */
  totalPages: z.number().int(),
  /**
   * Listas com paginação por cursor (auditoria, cupons pegos): passe em
   * `?cursor=` para a próxima página; null = acabou. Ausente nas demais listas.
   */
  nextCursor: z.string().nullable().optional(),
});
export type PageMeta = z.infer<typeof pageMetaSchema>;

export const paginated = <T extends z.ZodType>(item: T) =>
  z.object({ data: z.array(item), meta: pageMetaSchema });

export type Paginated<T> = { data: T[]; meta: PageMeta };

/** Lista completa (cadastros pequenos: andares, categorias, selos…). */
export const listOf = <T extends z.ZodType>(item: T) => z.object({ data: z.array(item) });
export type ListOf<T> = { data: T[] };

/** Booleano vindo da query string ("true"/"false"). */
export const booleanQuerySchema = z.enum(["true", "false"]).transform((v) => v === "true");

/* Erros ------------------------------------------------------------------ */

export const ERROR_CODES = [
  "VALIDATION_ERROR",
  "UNAUTHENTICATED",
  "INVALID_CREDENTIALS",
  "TOKEN_EXPIRED",
  "ACCOUNT_DISABLED",
  /** Lojista acertou a senha, mas o cadastro ainda espera a aprovação da ARP. 401. */
  "SIGNUP_PENDING",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "BUSINESS_RULE",
  "RATE_LIMITED",
  "PAYLOAD_TOO_LARGE",
  "UNSUPPORTED_MEDIA_TYPE",
  "INTERNAL_ERROR",
  /** Dependência externa indisponível ou não configurada (e-mail, login social). 503. */
  "SERVICE_UNAVAILABLE",
  // Domínio: conta do visitante
  /** Login social com e-mail que já tem conta por outro método. 409, details.provider. */
  "EMAIL_USES_OTHER_LOGIN",
  /** Conta nova pelo login social sem o aceite dos termos. 422. */
  "TERMS_REQUIRED",
  // Domínio: cupons
  "COUPON_SOLD_OUT",
  "COUPON_NOT_AVAILABLE",
  "COUPON_ALREADY_CLAIMED",
  "CLAIM_ALREADY_REDEEMED",
  "CLAIM_EXPIRED",
  "CLAIM_CANCELLED",
  "CLAIM_WRONG_STORE",
  "CLAIM_WRONG_DAY",
  // Domínio: selos
  "QR_INVALID",
  "QR_EXPIRED",
  "SEAL_ALREADY_EARNED",
  "PRIZE_OUT_OF_STOCK",
  "NOT_ENOUGH_POINTS",
] as const;
export const errorCodeSchema = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

/** Corpo de toda resposta de erro da API. */
export const apiErrorSchema = z.object({
  error: z.object({
    code: errorCodeSchema,
    message: z.string(),
    /** Em VALIDATION_ERROR: { campo: [mensagens] }. */
    details: z.unknown().optional(),
    requestId: z.string().optional(),
  }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

/* Enums transversais ----------------------------------------------------- */

/** Fase de algo com início e fim (campanha, destaque) em relação a agora. */
export const phaseSchema = z.enum(["upcoming", "live", "ended"]);
export type Phase = z.infer<typeof phaseSchema>;

/** Tons de cartão herdados do app (cupons, eventos sem foto). */
export const toneSchema = z.enum(["green", "ink", "clay", "sand", "deep"]);
export type Tone = z.infer<typeof toneSchema>;

/* Dias da semana do cupom (Fase 2) ---------------------------------------- */

/** 0 = domingo … 6 = sábado (igual a Date.getDay()). */
export const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;
export const WEEKDAY_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"] as const;

/** Dias em que o cupom pode ser usado: ao menos um, sem repetir, em ordem. */
export const weekdaysSchema = z
  .array(z.number().int().min(0).max(6))
  .min(1, "Escolha ao menos um dia")
  .max(7)
  .refine((l) => new Set(l).size === l.length, "Dia repetido")
  .transform((l) => [...l].sort((a, b) => a - b));

/** "todos os dias", "seg a sex", "sáb e dom", "seg, qua e sex". */
export function weekdaysLabel(days: readonly number[]): string {
  const set = [...new Set(days)].sort((a, b) => a - b);
  if (set.length === 7) return "todos os dias";
  if (set.join() === "1,2,3,4,5") return "seg a sex";
  if (set.join() === "0,6") return "sáb e dom";
  // começa na segunda (domingo por último), como no calendário do comércio
  const names = [...set.filter((d) => d !== 0), ...set.filter((d) => d === 0)].map(
    (d) => WEEKDAY_SHORT[d] ?? "",
  );
  return names.length === 1
    ? (names[0] ?? "")
    : `${names.slice(0, -1).join(", ")} e ${names.at(-1)}`;
}

/** Cupons usam só dois tons: verde e off-white ("sand"). Sem laranja (Fase 2). */
export const couponToneSchema = z.enum(["green", "sand"]);
export type CouponTone = z.infer<typeof couponToneSchema>;

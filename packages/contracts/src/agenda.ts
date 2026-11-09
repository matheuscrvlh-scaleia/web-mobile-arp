import { z } from "zod";
import {
  booleanQuerySchema,
  demoFlagSchema,
  iconNameSchema,
  idSchema,
  isoDateSchema,
  isoDateTimeSchema,
  listOf,
  mediaUrlSchema,
  paginated,
  paginationQuerySchema,
  patchOf,
  refSchema,
  timeOfDaySchema,
  toneSchema,
} from "./common";

/*
 * Agenda (vinda do app): o site quebrava com eventos longos. Aqui um evento
 * é de um dia (single), de um período (range: oficina de 3 dias, Corredor
 * Cultural o mês inteiro) ou semanal (weekly: feira todo sábado). Ninguém
 * cadastra dia a dia.
 */

export const eventCategorySchema = z.object({
  id: idSchema,
  name: z.string(),
  icon: iconNameSchema,
  sortOrder: z.number().int(),
  eventsCount: z.number().int(),
});
export type EventCategory = z.infer<typeof eventCategorySchema>;
export const eventCategoryListSchema = listOf(eventCategorySchema);

export const createEventCategoryBodySchema = z.object({
  name: z.string().trim().min(2).max(40),
  icon: iconNameSchema,
  sortOrder: z.number().int().min(0).max(999).default(0),
});
export type CreateEventCategoryBody = z.infer<typeof createEventCategoryBodySchema>;
export const updateEventCategoryBodySchema = z.object(patchOf(createEventCategoryBodySchema.shape));
export type UpdateEventCategoryBody = z.infer<typeof updateEventCategoryBodySchema>;

export const eventRecurrenceSchema = z.enum(["single", "range", "weekly"]);
export type EventRecurrence = z.infer<typeof eventRecurrenceSchema>;
/** paused: estava no app e saiu por um tempo ("Continuar" volta para published). */
export const eventStatusSchema = z.enum(["draft", "published", "paused", "cancelled"]);
export type EventStatus = z.infer<typeof eventStatusSchema>;

export const eventSchema = z.object({
  id: idSchema,
  title: z.string(),
  category: z.object({ id: idSchema, name: z.string(), icon: iconNameSchema }),
  description: z.string(),
  imageUrl: z.string().nullable(),
  /** Sem foto, o app usa o tom e o ícone. */
  tone: toneSchema.nullable(),
  icon: iconNameSchema.nullable(),
  place: z.string(),
  floor: z.object({ id: idSchema, label: z.string() }).nullable(),
  store: refSchema.nullable(),
  recurrence: eventRecurrenceSchema,
  /** single: o dia. range: primeiro dia. weekly: a partir de quando vale. */
  startsOn: isoDateSchema,
  /** range: último dia. weekly: até quando (null = sem fim). single: null. */
  endsOn: isoDateSchema.nullable(),
  /** weekly: primeiro dia de `weekdays` (compatibilidade). 0 = domingo … 6 = sábado. */
  weekday: z.number().int().min(0).max(6).nullable(),
  /** weekly: todos os dias da semana em que acontece (ex.: terça e quinta). */
  weekdays: z.array(z.number().int().min(0).max(6)).nullable(),
  startTime: timeOfDaySchema.nullable(),
  endTime: timeOfDaySchema.nullable(),
  /** Aparece como faixa em todos os dias da agenda (ex.: o mês inteiro). */
  isLongRunning: z.boolean(),
  /** Participar vale selo (o desafio liga ao evento). */
  awardsSeal: z.boolean(),
  status: eventStatusSchema,
  /** Página do evento no site, quando veio da importação; null = cadastrado aqui. */
  siteUrl: z.string().nullable(),
  interestsCount: z.number().int(),
  /** Arquivado: fora das listas padrão e do calendário (null = não arquivado). */
  archivedAt: isoDateTimeSchema.nullable(),
  isDemo: demoFlagSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});
export type Event = z.infer<typeof eventSchema>;
export const eventPageSchema = paginated(eventSchema);

/** Dias da semana do evento semanal (sem repetir). */
export const eventWeekdaysSchema = z
  .array(z.number().int().min(0).max(6))
  .min(1, "Escolha pelo menos um dia da semana")
  .max(7)
  .refine((d) => new Set(d).size === d.length, "Dia da semana repetido");

const eventFields = {
  title: z
    .string()
    .trim()
    .min(3, "Dê um nome ao evento (pelo menos 3 letras)")
    .max(120, "Use até 120 letras"),
  categoryId: z.uuid({ error: "Escolha a categoria" }),
  description: z.string().trim().max(1200).default(""),
  imageUrl: mediaUrlSchema.nullable().optional(),
  tone: toneSchema.nullable().optional(),
  icon: iconNameSchema.nullable().optional(),
  place: z
    .string()
    .trim()
    .min(2, "Diga onde acontece (ex.: Praça central)")
    .max(120, "Use até 120 letras"),
  floorId: idSchema.nullable().optional(),
  storeId: idSchema.nullable().optional(),
  recurrence: eventRecurrenceSchema,
  startsOn: isoDateSchema,
  endsOn: isoDateSchema.nullable().optional(),
  /** Legado (um dia só); prefira `weekdays`. */
  weekday: z.number().int().min(0).max(6).nullable().optional(),
  weekdays: eventWeekdaysSchema.nullable().optional(),
  startTime: timeOfDaySchema.nullable().optional(),
  endTime: timeOfDaySchema.nullable().optional(),
  isLongRunning: z.boolean().default(false),
  awardsSeal: z.boolean().default(false),
  status: eventStatusSchema.default("draft"),
};

type RecurrenceShape = {
  recurrence?: EventRecurrence;
  startsOn?: string;
  endsOn?: string | null;
  weekday?: number | null;
  weekdays?: number[] | null;
};

/** Coerência da recorrência; vale para criar e (com todos os campos) para editar. */
export function recurrenceIssues(v: RecurrenceShape): { path: string; message: string }[] {
  const issues: { path: string; message: string }[] = [];
  if (v.recurrence === "range" && !v.endsOn) {
    issues.push({ path: "endsOn", message: "Informe o último dia do período" });
  }
  if (v.recurrence === "weekly" && v.weekday == null && !v.weekdays?.length) {
    issues.push({ path: "weekdays", message: "Escolha pelo menos um dia da semana" });
  }
  if (v.startsOn && v.endsOn && v.endsOn < v.startsOn) {
    issues.push({ path: "endsOn", message: "O fim precisa ser depois do início" });
  }
  return issues;
}

export const createEventBodySchema = z.object(eventFields).superRefine((v, ctx) => {
  for (const i of recurrenceIssues(v)) ctx.addIssue({ code: "custom", ...i, path: [i.path] });
});
export type CreateEventBody = z.infer<typeof createEventBodySchema>;
export type CreateEventInput = z.input<typeof createEventBodySchema>;

/** Editar valida a recorrência final (atual + mudanças) no domínio. */
export const updateEventBodySchema = z.object(patchOf(eventFields));
export type UpdateEventBody = z.infer<typeof updateEventBodySchema>;

export const listEventsQuerySchema = paginationQuerySchema.extend({
  categoryId: idSchema.optional(),
  status: eventStatusSchema.optional(),
  recurrence: eventRecurrenceSchema.optional(),
  /** Eventos que acontecem em algum dia do intervalo. */
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  /** true = só os arquivados; ausente/false = só os não arquivados. */
  archived: booleanQuerySchema.optional(),
});
export type ListEventsQuery = z.infer<typeof listEventsQuerySchema>;

/** Adiar: nova data de início; o fim (período/semanal) anda junto, mantendo a duração. */
export const postponeEventBodySchema = z.object({ startsOn: isoDateSchema });
export type PostponeEventBody = z.infer<typeof postponeEventBodySchema>;

/** Calendário: em quais dias do intervalo cada evento acontece. */
export const eventOccurrencesQuerySchema = z.object({
  from: isoDateSchema,
  to: isoDateSchema,
});
export const eventOccurrencesSchema = z.object({
  data: z.array(
    z.object({
      date: isoDateSchema,
      events: z.array(
        z.object({
          id: idSchema,
          title: z.string(),
          isLongRunning: z.boolean(),
          startTime: timeOfDaySchema.nullable(),
          status: eventStatusSchema,
        }),
      ),
    }),
  ),
});
export type EventOccurrences = z.infer<typeof eventOccurrencesSchema>;

/* Sincronização com o site (espacoarp.com.br) ---------------------------- */

/**
 * Deixa a agenda igual ao site: post novo (de hoje em diante) entra fora do
 * app na categoria escolhida; editado lá é atualizado aqui; apagado lá é
 * apagado aqui. Mostrar ou não no app continua sendo escolha do gestor.
 */
export const syncSiteEventsBodySchema = z.object({ categoryId: idSchema });
export type SyncSiteEventsBody = z.infer<typeof syncSiteEventsBodySchema>;

export const syncSiteEventsResultSchema = z.object({
  /** Eventos novos (entram fora do app). */
  created: z.number().int(),
  /** Já existiam e mudaram no site. */
  updated: z.number().int(),
  /** Apagados aqui porque saíram do site. */
  removed: z.number().int(),
  /** Vieram com dados que a agenda não aceita (ex.: sem data). */
  failed: z.number().int(),
});
export type SyncSiteEventsResult = z.infer<typeof syncSiteEventsResultSchema>;

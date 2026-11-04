import { z } from "zod";
import {
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
  /** weekly: 0 = domingo … 6 = sábado. */
  weekday: z.number().int().min(0).max(6).nullable(),
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
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});
export type Event = z.infer<typeof eventSchema>;
export const eventPageSchema = paginated(eventSchema);

const eventFields = {
  title: z.string().trim().min(3).max(120),
  categoryId: idSchema,
  description: z.string().trim().max(1200).default(""),
  imageUrl: mediaUrlSchema.nullable().optional(),
  tone: toneSchema.nullable().optional(),
  icon: iconNameSchema.nullable().optional(),
  place: z.string().trim().min(2).max(120),
  floorId: idSchema.nullable().optional(),
  storeId: idSchema.nullable().optional(),
  recurrence: eventRecurrenceSchema,
  startsOn: isoDateSchema,
  endsOn: isoDateSchema.nullable().optional(),
  weekday: z.number().int().min(0).max(6).nullable().optional(),
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
};

/** Coerência da recorrência; vale para criar e (com todos os campos) para editar. */
export function recurrenceIssues(v: RecurrenceShape): { path: string; message: string }[] {
  const issues: { path: string; message: string }[] = [];
  if (v.recurrence === "range" && !v.endsOn) {
    issues.push({ path: "endsOn", message: "Informe o último dia do período" });
  }
  if (v.recurrence === "weekly" && v.weekday == null) {
    issues.push({ path: "weekday", message: "Escolha o dia da semana" });
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
});
export type ListEventsQuery = z.infer<typeof listEventsQuerySchema>;

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

/* Importação do site (espacoarp.com.br) ----------------------------------- */

/** Traz do site os eventos de hoje em diante que ainda não vieram, como rascunho. */
export const importSiteEventsBodySchema = z.object({ categoryId: idSchema });
export type ImportSiteEventsBody = z.infer<typeof importSiteEventsBodySchema>;

export const importSiteEventsResultSchema = z.object({
  /** Eventos novos criados como rascunho. */
  created: z.number().int(),
  /** Já importados antes (mesmo que apagados aqui depois). */
  skipped: z.number().int(),
  /** Vieram com dados que a agenda não aceita (ex.: sem data). */
  failed: z.number().int(),
});
export type ImportSiteEventsResult = z.infer<typeof importSiteEventsResultSchema>;

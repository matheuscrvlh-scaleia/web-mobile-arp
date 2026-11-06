import { z } from "zod";
import { eventRecurrenceSchema } from "../agenda";
import { iconNameSchema, idSchema, isoDateSchema, timeOfDaySchema, toneSchema } from "../common";
import { storeLinkSchema } from "./coupons";

/* Agenda do app: só eventos publicados. */

export const AGENDA_MAX_DAYS = 62;

export const eventCardSchema = z.object({
  id: idSchema,
  title: z.string(),
  category: z.object({ id: idSchema, name: z.string(), icon: iconNameSchema }),
  imageUrl: z.string().nullable(),
  tone: toneSchema.nullable(),
  icon: iconNameSchema.nullable(),
  place: z.string(),
  recurrence: eventRecurrenceSchema,
  startsOn: isoDateSchema,
  endsOn: isoDateSchema.nullable(),
  /** Primeiro dia de `weekdays` (apps antigos leem só este). */
  weekday: z.number().int().min(0).max(6).nullable(),
  /** weekly: todos os dias em que acontece (ex.: terça e quinta). */
  weekdays: z.array(z.number().int().min(0).max(6)).nullable(),
  startTime: timeOfDaySchema.nullable(),
  endTime: timeOfDaySchema.nullable(),
  isLongRunning: z.boolean(),
  awardsSeal: z.boolean(),
  /** Próximo dia em que acontece a partir de hoje (null se já terminou). */
  nextDate: isoDateSchema.nullable(),
});
export type EventCard = z.infer<typeof eventCardSchema>;

export const agendaEventSchema = eventCardSchema.omit({ nextDate: true });
export type AgendaEvent = z.infer<typeof agendaEventSchema>;

export const agendaQuerySchema = z
  .object({
    from: isoDateSchema,
    to: isoDateSchema,
    categoryId: idSchema.optional(),
  })
  .refine((v) => v.to >= v.from, { message: "O fim precisa ser depois do início", path: ["to"] })
  .refine(
    (v) =>
      Date.parse(`${v.to}T12:00:00Z`) - Date.parse(`${v.from}T12:00:00Z`) <=
      AGENDA_MAX_DAYS * 86_400_000,
    { message: `Intervalo máximo de ${AGENDA_MAX_DAYS} dias`, path: ["to"] },
  );
export type AgendaQuery = z.infer<typeof agendaQuerySchema>;

/** Só os dias do intervalo que têm evento. */
export const agendaSchema = z.object({
  days: z.array(
    z.object({
      date: isoDateSchema,
      /** Mesmos campos do cartão (período e recorrência inclusos), sem `nextDate`. */
      events: z.array(agendaEventSchema),
    }),
  ),
});
export type Agenda = z.infer<typeof agendaSchema>;

export const eventDetailSchema = eventCardSchema.extend({
  description: z.string(),
  floor: z.object({ id: idSchema, label: z.string() }).nullable(),
  store: storeLinkSchema.nullable(),
  interestsCount: z.number().int(),
  /** false sem login. */
  isInterested: z.boolean(),
});
export type EventDetail = z.infer<typeof eventDetailSchema>;

import {
  type CreateEventBody,
  createEventBodySchema,
  type Event,
  type UpdateEventBody,
} from "@arp/contracts";
import type { z } from "zod";
import { copyName } from "@/shared/hooks";
import { todayIso } from "@/shared/lib/dates";
import { pickDirty } from "@/shared/lib/forms";

/** O formulário usa o schema de criação do contrato (com a coerência da recorrência). */
export const eventFormSchema = createEventBodySchema;
export type EventFormInput = z.input<typeof eventFormSchema>;
export type EventFormValues = z.output<typeof eventFormSchema>;

export const EVENT_FORM_FIELDS = [
  "title",
  "categoryId",
  "description",
  "imageUrl",
  "tone",
  "icon",
  "place",
  "floorId",
  "storeId",
  "recurrence",
  "startsOn",
  "endsOn",
  "weekdays",
  "periods",
  "startTime",
  "endTime",
  "isLongRunning",
  "awardsSeal",
  "ticketUrl",
  "status",
] as const;

/** Campos que, juntos, definem quando o evento acontece. */
const RECURRENCE_FIELDS = [
  "recurrence",
  "startsOn",
  "endsOn",
  "weekdays",
  "periods",
  "isLongRunning",
] as const;

/**
 * Valores do formulário. `copy` = "Duplicar": nome com "(cópia)" e rascunho;
 * o resto vem igual (as datas ficam para revisar).
 */
export function eventToFormValues(event?: Event, { copy = false } = {}): EventFormInput {
  return {
    title: event ? (copy ? copyName(event.title) : event.title) : "",
    categoryId: event?.category.id ?? "",
    description: event?.description ?? "",
    imageUrl: event?.imageUrl ?? null,
    tone: event?.tone ?? "green",
    icon: event?.icon ?? null,
    place: event?.place ?? "",
    floorId: event?.floor?.id ?? null,
    storeId: event?.store?.id ?? null,
    recurrence: event?.recurrence ?? "single",
    startsOn: event?.startsOn ?? todayIso(),
    endsOn: event?.endsOn ?? null,
    weekdays: event?.weekdays ?? (event?.weekday == null ? null : [event.weekday]),
    periods: event?.periods ?? null,
    startTime: event?.startTime ?? null,
    endTime: event?.endTime ?? null,
    isLongRunning: event?.isLongRunning ?? false,
    awardsSeal: event?.awardsSeal ?? false,
    ticketUrl: event?.ticketUrl ?? null,
    status: copy ? "draft" : (event?.status ?? "draft"),
  };
}

/** Zera o que não vale para a recorrência escolhida (ex.: dia da semana num período). */
export function cleanRecurrence(values: EventFormValues): CreateEventBody {
  // O formulário só usa `weekdays`; o campo legado não vai.
  const { weekday: _legacy, ...v } = values;
  if (v.recurrence === "single") {
    return { ...v, endsOn: null, weekdays: null, periods: null, isLongRunning: false };
  }
  if (v.recurrence === "range") {
    return { ...v, weekdays: null, periods: (v.periods?.length ?? 0) > 1 ? v.periods : null };
  }
  return { ...v, periods: null, isLongRunning: false };
}

/**
 * PATCH do evento: só o que mudou; mas se algo da recorrência mudou, vai o
 * conjunto inteiro (a API valida a recorrência final como um todo).
 */
export function eventPatch(
  values: EventFormValues,
  dirty: Partial<Record<keyof EventFormValues, unknown>>,
): UpdateEventBody {
  const clean = cleanRecurrence(values);
  const body: UpdateEventBody = pickDirty(clean, dirty);
  if (RECURRENCE_FIELDS.some((k) => dirty[k])) {
    for (const k of RECURRENCE_FIELDS) Object.assign(body, { [k]: clean[k] });
  }
  return body;
}

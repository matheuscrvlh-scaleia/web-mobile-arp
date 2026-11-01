import {
  type CreateEventBody,
  createEventBodySchema,
  type Event,
  type UpdateEventBody,
} from "@arp/contracts";
import type { z } from "zod";
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
  "weekday",
  "startTime",
  "endTime",
  "isLongRunning",
  "awardsSeal",
  "status",
] as const;

/** Campos que, juntos, definem quando o evento acontece. */
const RECURRENCE_FIELDS = ["recurrence", "startsOn", "endsOn", "weekday", "isLongRunning"] as const;

export function eventToFormValues(event?: Event): EventFormInput {
  return {
    title: event?.title ?? "",
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
    weekday: event?.weekday ?? null,
    startTime: event?.startTime ?? null,
    endTime: event?.endTime ?? null,
    isLongRunning: event?.isLongRunning ?? false,
    awardsSeal: event?.awardsSeal ?? false,
    status: event?.status ?? "draft",
  };
}

/** Zera o que não vale para a recorrência escolhida (ex.: dia da semana num período). */
export function cleanRecurrence(v: EventFormValues): CreateEventBody {
  if (v.recurrence === "single") {
    return { ...v, endsOn: null, weekday: null, isLongRunning: false };
  }
  if (v.recurrence === "range") return { ...v, weekday: null };
  return { ...v, isLongRunning: false };
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

import { createEventBodySchema, type Event } from "@arp/contracts";
import type { z } from "zod";
import { copyName } from "@/shared/hooks";
import { todayIso } from "@/shared/lib/dates";

/** O formulário usa o schema de criação do contrato (com a coerência da recorrência). */
export const eventFormSchema = createEventBodySchema;
export type EventFormInput = z.input<typeof eventFormSchema>;
export type EventFormValues = z.output<typeof eventFormSchema>;

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

import type { UseFormReturn } from "react-hook-form";
import type { EventFormInput, EventFormValues } from "../../lib/form";

export type EventFormHandle = UseFormReturn<EventFormInput, unknown, EventFormValues>;

export interface EventFormContext {
  form: EventFormHandle;
  /** Libera a saída da tela (depois de criar, antes de navegar). */
  allowLeave: () => void;
}

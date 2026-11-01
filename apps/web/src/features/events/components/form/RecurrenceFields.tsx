import type { EventRecurrence } from "@arp/contracts";
import { CalendarDays, CalendarRange, Repeat } from "lucide-react";
import { Controller, useWatch } from "react-hook-form";
import { WEEKDAY_SHORT } from "@/shared/lib/dates";
import { emptyToNull } from "@/shared/lib/text";
import { Field, FieldRow, Input, Segmented, Switch, type TabItem } from "@/shared/ui";
import { describeWhen } from "../../lib/when";
import type { EventFormHandle } from "./types";

const RECURRENCE_OPTIONS: TabItem<EventRecurrence>[] = [
  { value: "single", label: "Um dia", icon: CalendarDays },
  { value: "range", label: "Período", icon: CalendarRange },
  { value: "weekly", label: "Toda semana", icon: Repeat },
];

const WEEKDAY_OPTIONS: TabItem<string>[] = WEEKDAY_SHORT.map((d, i) => ({
  value: String(i),
  label: d.charAt(0).toUpperCase() + d.slice(1),
}));

const nullable = { setValueAs: emptyToNull };

/**
 * Quando acontece: só os campos da recorrência escolhida, com o resumo em
 * texto como o app vai escrever.
 */
export function RecurrenceFields({ form, readOnly }: { form: EventFormHandle; readOnly: boolean }) {
  const { register, control, formState } = form;
  const { errors } = formState;
  const [recurrence, startsOn, endsOn, weekday, startTime, endTime, isLongRunning] = useWatch({
    control,
    name: ["recurrence", "startsOn", "endsOn", "weekday", "startTime", "endTime", "isLongRunning"],
  });
  const summary = describeWhen({
    recurrence,
    startsOn,
    endsOn,
    weekday,
    startTime,
    endTime,
    isLongRunning,
  });

  return (
    <>
      <Field label="Repetição" required error={errors.recurrence?.message}>
        <Controller
          control={control}
          name="recurrence"
          render={({ field }) => (
            <Segmented
              label="Repetição"
              options={RECURRENCE_OPTIONS}
              value={field.value}
              onChange={field.onChange}
              className={readOnly ? "pointer-events-none opacity-70" : undefined}
            />
          )}
        />
      </Field>

      {recurrence === "weekly" && (
        <Field label="Dia da semana" required error={errors.weekday?.message}>
          <Controller
            control={control}
            name="weekday"
            render={({ field }) => (
              <Segmented
                label="Dia da semana"
                size="sm"
                options={WEEKDAY_OPTIONS}
                value={field.value == null ? "" : String(field.value)}
                onChange={(v) => field.onChange(Number(v))}
                className={readOnly ? "pointer-events-none opacity-70" : undefined}
              />
            )}
          />
        </Field>
      )}

      <FieldRow>
        <Field
          label={
            recurrence === "single"
              ? "Dia"
              : recurrence === "range"
                ? "Primeiro dia"
                : "A partir de"
          }
          required
          error={errors.startsOn?.message}
        >
          <Input type="date" {...register("startsOn")} />
        </Field>
        {recurrence !== "single" && (
          <Field
            label={recurrence === "range" ? "Último dia" : "Até"}
            required={recurrence === "range"}
            optional={recurrence === "weekly"}
            hint={recurrence === "weekly" ? "Sem data, repete sem fim." : undefined}
            error={errors.endsOn?.message}
          >
            <Input type="date" min={startsOn} {...register("endsOn", nullable)} />
          </Field>
        )}
      </FieldRow>

      <FieldRow>
        <Field label="Começa às" optional error={errors.startTime?.message}>
          <Input type="time" {...register("startTime", nullable)} />
        </Field>
        <Field label="Termina às" optional error={errors.endTime?.message}>
          <Input type="time" {...register("endTime", nullable)} />
        </Field>
      </FieldRow>

      {recurrence === "range" && (
        <Controller
          control={control}
          name="isLongRunning"
          render={({ field }) => (
            <Switch
              checked={Boolean(field.value)}
              onCheckedChange={field.onChange}
              disabled={readOnly}
              label="Evento longo (faixa)"
              description="Aparece como faixa em todos os dias da agenda, com a barra do mês (ex.: Corredor Cultural)."
            />
          )}
        />
      )}

      <p
        aria-live="polite"
        className="flex items-center gap-2 rounded-2xl bg-neutral-900/[0.05] px-4 py-3 text-sm text-neutral-800"
      >
        <CalendarDays className="size-4 shrink-0 text-neutral-500" aria-hidden />
        <span>
          <span className="text-neutral-500">No app: </span>
          <b className="font-semibold">{summary}</b>
        </span>
      </p>
    </>
  );
}

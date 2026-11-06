import type { EventRecurrence } from "@arp/contracts";
import { CalendarDays, CalendarRange, MoonStar, Repeat } from "lucide-react";
import { Controller, useWatch } from "react-hook-form";
import { cn } from "@/shared/lib/cn";
import { WEEKDAY_LABEL, WEEKDAY_SHORT } from "@/shared/lib/dates";
import { emptyToNull } from "@/shared/lib/text";
import { Field, FieldRow, Input, Segmented, Switch, type TabItem } from "@/shared/ui";
import { crossesMidnight, describeWhen } from "../../lib/when";
import type { EventFormHandle } from "./types";

const RECURRENCE_OPTIONS: TabItem<EventRecurrence>[] = [
  { value: "single", label: "Um dia", icon: CalendarDays },
  { value: "range", label: "Período", icon: CalendarRange },
  { value: "weekly", label: "Toda semana", icon: Repeat },
];

/** Segunda primeiro, domingo por último (como se fala). */
const WEEK = [1, 2, 3, 4, 5, 6, 0].map((day) => ({
  day,
  label: (WEEKDAY_SHORT[day] ?? "").replace(/^./, (c) => c.toUpperCase()),
}));

const nullable = { setValueAs: emptyToNull };

/**
 * Quando acontece: só os campos da recorrência escolhida, com o resumo em
 * texto como o app vai escrever.
 */
export function RecurrenceFields({ form, readOnly }: { form: EventFormHandle; readOnly: boolean }) {
  const { register, control, formState } = form;
  const { errors } = formState;
  const [recurrence, startsOn, endsOn, weekdays, startTime, endTime, isLongRunning] = useWatch({
    control,
    name: ["recurrence", "startsOn", "endsOn", "weekdays", "startTime", "endTime", "isLongRunning"],
  });
  const summary = describeWhen({
    recurrence,
    startsOn,
    endsOn,
    weekdays,
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
        <Field
          label="Dias da semana"
          required
          hint={
            (weekdays?.length ?? 0) > 1
              ? `Atenção: a versão atual do app mostra só o primeiro dia (${(WEEKDAY_LABEL[weekdays?.[0] ?? 0] ?? "").toLowerCase()}) até ser atualizada. O painel já guarda todos.`
              : "Toque em quantos dias quiser (ex.: terça e quinta)."
          }
          error={errors.weekdays?.message}
        >
          <Controller
            control={control}
            name="weekdays"
            render={({ field }) => {
              const value = field.value ?? [];
              const toggle = (day: number) => {
                const next = value.includes(day) ? value.filter((d) => d !== day) : [...value, day];
                field.onChange(next.length ? next.sort((a, b) => a - b) : null);
              };
              return (
                <fieldset aria-label="Dias da semana" className="flex flex-wrap gap-1.5">
                  {WEEK.map(({ day, label }) => {
                    const on = value.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        aria-pressed={on}
                        disabled={readOnly}
                        onClick={() => toggle(day)}
                        className={cn(
                          "h-11 min-w-12 rounded-full border px-3 text-sm font-semibold transition disabled:opacity-60 sm:h-9",
                          on
                            ? "border-neutral-900 bg-neutral-900 text-white"
                            : "border-neutral-300 bg-white text-neutral-700 hover:border-neutral-500",
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </fieldset>
              );
            }}
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
      {crossesMidnight(startTime, endTime) && (
        <p className="flex items-start gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <MoonStar className="mt-0.5 size-4 shrink-0" aria-hidden />
          Termina no dia seguinte? O fim ({endTime}) é antes do início ({startTime}). Se foi engano,
          troque os horários.
        </p>
      )}

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

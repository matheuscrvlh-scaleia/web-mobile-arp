import type { EventRecurrence } from "@arp/contracts";
import { CalendarDays, CalendarRange, MoonStar, Plus, Repeat, X } from "lucide-react";
import { Controller, useWatch } from "react-hook-form";
import { cn } from "@/shared/lib/cn";
import { WEEKDAY_LABEL, WEEKDAY_SHORT } from "@/shared/lib/dates";
import { emptyToNull } from "@/shared/lib/text";
import { Button, Field, FieldRow, Input, Segmented, Switch, type TabItem } from "@/shared/ui";
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
  const { register, control, formState, setValue } = form;
  const { errors } = formState;
  const [recurrence, startsOn, endsOn, weekdays, periods, startTime, endTime, isLongRunning] =
    useWatch({
      control,
      name: [
        "recurrence",
        "startsOn",
        "endsOn",
        "weekdays",
        "periods",
        "startTime",
        "endTime",
        "isLongRunning",
      ],
    });
  const multi = recurrence === "range" && (periods?.length ?? 0) > 1;
  /** Grava a lista e mantém o início/fim do evento = primeiro e último dia. */
  const setPeriods = (next: { startsOn: string; endsOn: string }[]) => {
    const opts = { shouldDirty: true, shouldValidate: formState.isSubmitted };
    if (next.length <= 1) {
      setValue("periods", null, opts);
      if (next[0]) {
        setValue("startsOn", next[0].startsOn, opts);
        setValue("endsOn", next[0].endsOn || null, opts);
      }
      return;
    }
    setValue("periods", next, opts);
    const days = next
      .flatMap((p) => [p.startsOn, p.endsOn])
      .filter(Boolean)
      .sort();
    if (days[0]) setValue("startsOn", days[0], opts);
    setValue("endsOn", days.at(-1) ?? null, opts);
  };
  const addPeriod = () => {
    const current = multi ? (periods ?? []) : [{ startsOn: startsOn ?? "", endsOn: endsOn ?? "" }];
    setPeriods([...current, { startsOn: "", endsOn: "" }]);
  };
  const editPeriod = (i: number, patch: Partial<{ startsOn: string; endsOn: string }>) =>
    setPeriods((periods ?? []).map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const summary = describeWhen({
    recurrence,
    startsOn,
    endsOn,
    weekdays,
    periods: multi ? periods : null,
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

      {multi ? (
        <Field
          label="Períodos"
          required
          hint="Cada período aparece na agenda só nos seus dias (ex.: 10 a 12 e 17 a 19)."
          error={errors.periods?.message ?? errors.startsOn?.message ?? errors.endsOn?.message}
        >
          <div className="space-y-2">
            {(periods ?? []).map((p, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: linhas do formulário, sem identidade
              <div key={i} className="flex items-center gap-2">
                <Input
                  type="date"
                  aria-label={`Início do período ${i + 1}`}
                  value={p.startsOn}
                  disabled={readOnly}
                  onChange={(e) => editPeriod(i, { startsOn: e.target.value })}
                />
                <span className="text-sm text-neutral-500">a</span>
                <Input
                  type="date"
                  aria-label={`Fim do período ${i + 1}`}
                  value={p.endsOn}
                  min={p.startsOn || undefined}
                  disabled={readOnly}
                  onChange={(e) => editPeriod(i, { endsOn: e.target.value })}
                />
                {!readOnly && (
                  <button
                    type="button"
                    aria-label={`Tirar o período ${i + 1}`}
                    onClick={() => setPeriods((periods ?? []).filter((_, j) => j !== i))}
                    className="grid size-11 shrink-0 place-items-center rounded-full text-neutral-500 hover:bg-neutral-100 sm:size-9"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                )}
              </div>
            ))}
          </div>
        </Field>
      ) : (
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
      )}
      {recurrence === "range" && !readOnly && (
        <div>
          <Button variant="secondary" size="sm" icon={Plus} onClick={addPeriod}>
            Adicionar outro período (ex.: 10 a 12 e 17 a 19)
          </Button>
        </div>
      )}

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

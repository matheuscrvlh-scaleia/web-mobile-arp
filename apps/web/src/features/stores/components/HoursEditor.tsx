import {
  overlappingWeekdays,
  STORE_HOURS_PER_DAY_MAX,
  type StoreDetail,
  type StoreHours,
} from "@arp/contracts";
import { CircleAlert, CopyCheck, Moon, Plus, X } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import { errorMessage } from "@/shared/api";
import { useUnsavedChangesGuard } from "@/shared/hooks";
import { cn } from "@/shared/lib/cn";
import { Button, Card, CardHeader, IconButton, Input, SaveBar, Switch, toast } from "@/shared/ui";
import { useUpdateStore } from "../api";

/** Segunda primeiro (como o lojista pensa a semana); no contrato 0 = domingo. */
const WEEK: { weekday: number; label: string }[] = [
  { weekday: 1, label: "Segunda" },
  { weekday: 2, label: "Terça" },
  { weekday: 3, label: "Quarta" },
  { weekday: 4, label: "Quinta" },
  { weekday: 5, label: "Sexta" },
  { weekday: 6, label: "Sábado" },
  { weekday: 0, label: "Domingo" },
];

interface Slot {
  opensAt: string;
  closesAt: string;
}
interface DayRow {
  open: boolean;
  /** Um ou mais intervalos (ex.: 11:00–15:00 e 18:00–23:00). */
  slots: Slot[];
}
type Week = Record<number, DayRow>;

const DEFAULT_SLOT: Slot = { opensAt: "10:00", closesAt: "22:00" };

function toWeek(hours: StoreHours[]): Week {
  const week: Week = {};
  for (const { weekday } of WEEK) {
    const slots = hours
      .filter((x) => x.weekday === weekday)
      .sort((a, b) => a.opensAt.localeCompare(b.opensAt))
      .map(({ opensAt, closesAt }) => ({ opensAt, closesAt }));
    week[weekday] =
      slots.length > 0 ? { open: true, slots } : { open: false, slots: [DEFAULT_SLOT] };
  }
  return week;
}

function toHours(week: Week): StoreHours[] {
  return WEEK.flatMap(({ weekday }) => {
    const d = week[weekday];
    return d?.open ? d.slots.map((s) => ({ weekday, ...s })) : [];
  });
}

const key = (h: StoreHours) => `${h.weekday}-${h.opensAt}-${h.closesAt}`;
const same = (a: StoreHours[], b: StoreHours[]) =>
  JSON.stringify(a.map(key).sort()) === JSON.stringify(b.map(key).sort());

/** Sugestão para o 2º intervalo: começa 1h depois do fim do último. */
function nextSlot(slots: Slot[]): Slot {
  const last = slots.at(-1) ?? DEFAULT_SLOT;
  const [h = 0, m = 0] = last.closesAt.split(":").map(Number);
  const start = Math.min(h + 1, 22);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    opensAt: `${pad(start)}:${pad(m)}`,
    closesAt: `${pad(Math.min(start + 4, 23))}:${pad(m)}`,
  };
}

/**
 * Horários por dia da semana, com até 3 intervalos por dia (almoço e
 * jantar). Fechar antes de abrir = passa da meia-noite (ex.: 16:00 às
 * 00:30). Dia desligado = fechado.
 */
export function HoursEditor({ store, readOnly }: { store: StoreDetail; readOnly: boolean }) {
  const update = useUpdateStore(store.id);
  const saved = store.hours;
  const [week, setWeek] = useState<Week>(() => toWeek(saved));
  // Os horários mudaram no servidor e não há alteração local pendente: acompanha.
  const [lastSaved, setLastSaved] = useState(saved);
  if (lastSaved !== saved) {
    setLastSaved(saved);
    if (same(toHours(week), lastSaved)) setWeek(toWeek(saved));
  }
  const current = useMemo(() => toHours(week), [week]);
  const dirty = !same(current, saved);
  useUnsavedChangesGuard(dirty && !update.isPending);

  const sameTime = WEEK.filter(({ weekday }) => {
    const d = week[weekday];
    return d?.open && d.slots.some((s) => s.opensAt === s.closesAt);
  }).map((w) => w.weekday);
  const overlapping = overlappingWeekdays(current);
  const invalid = sameTime.length > 0 || overlapping.length > 0;

  const setDay = (weekday: number, patch: Partial<DayRow>) =>
    setWeek((w) => ({ ...w, [weekday]: { ...(w[weekday] as DayRow), ...patch } }));
  const setSlot = (weekday: number, index: number, patch: Partial<Slot>) =>
    setWeek((w) => {
      const d = w[weekday] as DayRow;
      return {
        ...w,
        [weekday]: { ...d, slots: d.slots.map((s, i) => (i === index ? { ...s, ...patch } : s)) },
      };
    });

  const copyToAll = (weekday: number) => {
    const src = week[weekday];
    if (!src) return;
    setWeek(
      Object.fromEntries(
        WEEK.map((d) => [d.weekday, { open: src.open, slots: src.slots.map((s) => ({ ...s })) }]),
      ),
    );
    toast.info(
      `Horário de ${WEEK.find((d) => d.weekday === weekday)?.label.toLowerCase()} copiado para todos os dias.`,
    );
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (invalid) return;
    update.mutate(
      { hours: current },
      {
        onSuccess: () => toast.success("Horários salvos."),
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  };

  return (
    <form onSubmit={onSubmit} noValidate>
      <Card>
        <CardHeader
          title="Horário de funcionamento"
          description="O app mostra “aberta agora” por estes horários, no fuso de Brasília. Restaurante que fecha à tarde: use “+ intervalo”."
        />
        <fieldset disabled={readOnly} className="min-w-0">
          <legend className="sr-only">Horários por dia da semana</legend>
          <ul className="flex flex-col divide-y divide-neutral-900/[0.06]">
            {WEEK.map(({ weekday, label }) => {
              const d = week[weekday] as DayRow;
              const overnight = d.open && d.slots.some((s) => s.closesAt < s.opensAt);
              const bad = sameTime.includes(weekday);
              const crossed = d.open && overlapping.includes(weekday);
              return (
                <li key={weekday} className="flex flex-wrap items-start gap-x-4 gap-y-2 py-3">
                  <span className="w-24 pt-2.5 text-sm font-medium text-neutral-900">{label}</span>
                  <Switch
                    checked={d.open}
                    onCheckedChange={(open) => setDay(weekday, { open })}
                    label={d.open ? "Aberta" : "Fechada"}
                    disabled={readOnly}
                    className="w-32 pt-2"
                  />
                  <div className={cn("flex flex-col gap-2", !d.open && "hidden")}>
                    {d.slots.map((s, i) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: intervalos sem id; a ordem é a identidade
                      <div key={i} className="flex items-center gap-2">
                        <Input
                          type="time"
                          step={300}
                          aria-label={`${label}, ${i + 1}º horário: abre às`}
                          value={s.opensAt}
                          onChange={(e) => setSlot(weekday, i, { opensAt: e.target.value })}
                          className="w-28"
                          aria-invalid={bad || crossed || undefined}
                        />
                        <span className="text-sm text-neutral-500">às</span>
                        <Input
                          type="time"
                          step={300}
                          aria-label={`${label}, ${i + 1}º horário: fecha às`}
                          value={s.closesAt}
                          onChange={(e) => setSlot(weekday, i, { closesAt: e.target.value })}
                          className="w-28"
                          aria-invalid={bad || crossed || undefined}
                        />
                        {!readOnly && d.slots.length > 1 && (
                          <IconButton
                            icon={X}
                            size="sm"
                            label={`Tirar o ${i + 1}º horário de ${label.toLowerCase()}`}
                            onClick={() =>
                              setDay(weekday, { slots: d.slots.filter((_, j) => j !== i) })
                            }
                          />
                        )}
                      </div>
                    ))}
                    {!readOnly && d.slots.length < STORE_HOURS_PER_DAY_MAX && (
                      <button
                        type="button"
                        onClick={() => setDay(weekday, { slots: [...d.slots, nextSlot(d.slots)] })}
                        className="inline-flex w-fit cursor-pointer items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-900/[0.06] hover:text-neutral-900"
                      >
                        <Plus className="size-3.5" aria-hidden />
                        intervalo
                        <span className="sr-only"> em {label.toLowerCase()}</span>
                      </button>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 pt-2.5">
                    {overnight && (
                      <span className="inline-flex items-center gap-1 text-xs text-neutral-500">
                        <Moon className="size-3.5" aria-hidden />
                        Fecha no dia seguinte
                      </span>
                    )}
                    {bad && (
                      <span
                        role="alert"
                        className="inline-flex items-center gap-1 text-xs font-medium text-red-700"
                      >
                        <CircleAlert className="size-3.5" aria-hidden />
                        Abre e fecha no mesmo horário
                      </span>
                    )}
                    {crossed && (
                      <span
                        role="alert"
                        className="inline-flex items-center gap-1 text-xs font-medium text-red-700"
                      >
                        <CircleAlert className="size-3.5" aria-hidden />
                        Os horários deste dia se cruzam
                      </span>
                    )}
                  </div>
                  {!readOnly && d.open && (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={CopyCheck}
                      className="ml-auto"
                      onClick={() => copyToAll(weekday)}
                    >
                      Copiar para todos
                      <span className="sr-only"> os dias (de {label.toLowerCase()})</span>
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </fieldset>
      </Card>
      {!readOnly && (
        <SaveBar
          dirty={dirty}
          saving={update.isPending}
          disabled={invalid}
          onReset={() => setWeek(toWeek(saved))}
          submitLabel="Salvar horários"
        />
      )}
    </form>
  );
}

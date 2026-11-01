import type { StoreDetail, StoreHours } from "@arp/contracts";
import { CircleAlert, CopyCheck, Moon } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import { errorMessage } from "@/shared/api";
import { useUnsavedChangesGuard } from "@/shared/hooks";
import { cn } from "@/shared/lib/cn";
import { Button, Card, CardHeader, Input, SaveBar, Switch, toast } from "@/shared/ui";
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

interface DayRow {
  open: boolean;
  opensAt: string;
  closesAt: string;
}
type Week = Record<number, DayRow>;

function toWeek(hours: StoreHours[]): Week {
  const week: Week = {};
  for (const { weekday } of WEEK) {
    const h = hours.find((x) => x.weekday === weekday);
    week[weekday] = h
      ? { open: true, opensAt: h.opensAt, closesAt: h.closesAt }
      : { open: false, opensAt: "10:00", closesAt: "22:00" };
  }
  return week;
}

function toHours(week: Week): StoreHours[] {
  return WEEK.flatMap(({ weekday }) => {
    const d = week[weekday];
    return d?.open ? [{ weekday, opensAt: d.opensAt, closesAt: d.closesAt }] : [];
  });
}

const same = (a: StoreHours[], b: StoreHours[]) =>
  JSON.stringify([...a].sort((x, y) => x.weekday - y.weekday)) ===
  JSON.stringify([...b].sort((x, y) => x.weekday - y.weekday));

/**
 * Horários por dia da semana. Fechar antes de abrir = passa da meia-noite
 * (ex.: 16:00 às 00:30). Dia desligado = fechado.
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

  const invalid = WEEK.filter(({ weekday }) => {
    const d = week[weekday];
    return d?.open && d.opensAt === d.closesAt;
  }).map((w) => w.weekday);

  const set = (weekday: number, patch: Partial<DayRow>) =>
    setWeek((w) => ({ ...w, [weekday]: { ...(w[weekday] as DayRow), ...patch } }));

  const copyToAll = (weekday: number) => {
    const src = week[weekday];
    if (!src) return;
    setWeek(Object.fromEntries(WEEK.map((d) => [d.weekday, { ...src }])));
    toast.info(
      `Horário de ${WEEK.find((d) => d.weekday === weekday)?.label.toLowerCase()} copiado para todos os dias.`,
    );
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (invalid.length > 0) return;
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
          description="O app mostra “aberta agora” por estes horários, no fuso de Brasília."
        />
        <fieldset disabled={readOnly} className="min-w-0">
          <legend className="sr-only">Horários por dia da semana</legend>
          <ul className="flex flex-col divide-y divide-neutral-900/[0.06]">
            {WEEK.map(({ weekday, label }) => {
              const d = week[weekday] as DayRow;
              const overnight = d.open && d.closesAt < d.opensAt;
              const bad = invalid.includes(weekday);
              return (
                <li key={weekday} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                  <span className="w-24 text-sm font-medium text-neutral-900">{label}</span>
                  <Switch
                    checked={d.open}
                    onCheckedChange={(open) => set(weekday, { open })}
                    label={d.open ? "Aberta" : "Fechada"}
                    disabled={readOnly}
                    className="w-32"
                  />
                  <div className={cn("flex items-center gap-2", !d.open && "invisible")}>
                    <Input
                      type="time"
                      step={300}
                      aria-label={`${label}: abre às`}
                      value={d.opensAt}
                      onChange={(e) => set(weekday, { opensAt: e.target.value })}
                      className="w-28"
                      aria-invalid={bad || undefined}
                    />
                    <span className="text-sm text-neutral-500">às</span>
                    <Input
                      type="time"
                      step={300}
                      aria-label={`${label}: fecha às`}
                      value={d.closesAt}
                      onChange={(e) => set(weekday, { closesAt: e.target.value })}
                      className="w-28"
                      aria-invalid={bad || undefined}
                    />
                  </div>
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
          disabled={invalid.length > 0}
          onReset={() => setWeek(toWeek(saved))}
          submitLabel="Salvar horários"
        />
      )}
    </form>
  );
}

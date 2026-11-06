import { cn } from "@/shared/lib/cn";
import { addDaysIso, currentMonth, monthBounds, todayIso } from "@/shared/lib/dates";
import { Input, Select } from "@/shared/ui";

/** Período em dias de São Paulo (inclusive). Vazio = todo o período. */
export interface Period {
  from?: string;
  to?: string;
}

type Preset = "all" | "today" | "7d" | "30d" | "month" | "lastMonth" | "custom";

function presetRange(p: Exclude<Preset, "all" | "custom">, today = todayIso()): Required<Period> {
  switch (p) {
    case "today":
      return { from: today, to: today };
    case "7d":
      return { from: addDaysIso(today, -6), to: today };
    case "30d":
      return { from: addDaysIso(today, -29), to: today };
    case "month": {
      const [from] = monthBounds(currentMonth());
      return { from, to: today };
    }
    case "lastMonth": {
      const [first] = monthBounds(currentMonth());
      const [from, to] = monthBounds(addDaysIso(first, -1).slice(0, 7));
      return { from, to };
    }
  }
}

const LABEL: Record<Preset, string> = {
  all: "Todo o período",
  today: "Hoje",
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
  month: "Este mês",
  lastMonth: "Mês passado",
  custom: "Escolher datas…",
};

function presetOf(v: Period): Preset {
  if (!v.from && !v.to) return "all";
  for (const p of ["today", "7d", "30d", "month", "lastMonth"] as const) {
    const r = presetRange(p);
    if (r.from === v.from && r.to === v.to) return p;
  }
  return "custom";
}

/** O período anterior, do mesmo tamanho (para comparar no relatório). */
export function previousPeriod(v: Required<Period>): Required<Period> {
  const days = Math.round((Date.parse(v.to) - Date.parse(v.from)) / 86_400_000) + 1;
  return { from: addDaysIso(v.from, -days), to: addDaysIso(v.from, -1) };
}

/** Os últimos 30 dias (padrão do relatório). */
export const last30Days = () => presetRange("30d");

/**
 * Atalhos de período (hoje, 7 e 30 dias, este mês, mês passado) e datas
 * livres para o resto (ex.: a semana da Black Friday).
 */
export function PeriodFilter({
  value,
  onChange,
  allowAll = false,
  className,
}: {
  value: Period;
  onChange: (v: Period) => void;
  /** Mostra "Todo o período" (filtro opcional, como em Cupons pegos). */
  allowAll?: boolean;
  className?: string;
}) {
  const preset = presetOf(value);
  const today = todayIso();
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Select
        aria-label="Período"
        value={preset}
        onChange={(e) => {
          const p = e.target.value as Preset;
          if (p === "all") onChange({});
          else if (p === "custom")
            onChange({ from: value.from ?? addDaysIso(today, -6), to: value.to ?? today });
          else onChange(presetRange(p));
        }}
        className="w-full sm:w-44"
      >
        {(Object.keys(LABEL) as Preset[])
          .filter((p) => allowAll || p !== "all")
          .map((p) => (
            <option key={p} value={p}>
              {LABEL[p]}
            </option>
          ))}
      </Select>
      {preset === "custom" && (
        <span className="flex w-full items-center gap-2 sm:w-auto">
          <Input
            type="date"
            aria-label="De"
            value={value.from ?? ""}
            max={value.to ?? today}
            onChange={(e) => e.target.value && onChange({ ...value, from: e.target.value })}
            className="min-w-0 flex-1 sm:w-40"
          />
          <span aria-hidden className="text-neutral-400">
            a
          </span>
          <Input
            type="date"
            aria-label="Até"
            value={value.to ?? ""}
            min={value.from}
            onChange={(e) => e.target.value && onChange({ ...value, to: e.target.value })}
            className="min-w-0 flex-1 sm:w-40"
          />
        </span>
      )}
    </div>
  );
}

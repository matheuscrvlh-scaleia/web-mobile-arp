import { WEEKDAY_SHORT, weekdaysLabel } from "@arp/contracts";

/** Segunda primeiro (como no comércio), domingo por último. */
const ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

/** Dias em que o cupom pode ser usado (Fase 2). Fora deles, a validação recusa. */
export function WeekdaysPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: readonly number[];
  onChange: (days: number[]) => void;
  disabled?: boolean;
}) {
  const toggle = (day: number) => {
    const next = value.includes(day) ? value.filter((d) => d !== day) : [...value, day];
    if (next.length > 0) onChange([...next].sort((a, b) => a - b));
  };
  return (
    <div>
      <fieldset className="flex flex-wrap gap-1.5 border-0 p-0" aria-label="Dias da semana">
        {ORDER.map((day) => {
          const on = value.includes(day);
          return (
            <button
              key={day}
              type="button"
              aria-pressed={on}
              disabled={disabled}
              onClick={() => toggle(day)}
              className={`h-9 w-12 rounded-full border text-xs font-semibold capitalize transition disabled:opacity-50 ${
                on
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-300 bg-white text-neutral-700 hover:border-neutral-400"
              }`}
            >
              {WEEKDAY_SHORT[day]}
            </button>
          );
        })}
      </fieldset>
      <p className="mt-1.5 text-xs text-neutral-500">Vale {weekdaysLabel(value)}.</p>
    </div>
  );
}

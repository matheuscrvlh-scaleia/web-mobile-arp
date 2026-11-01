import { cn } from "@/shared/lib/cn";
import { fromZonedInput, toZonedInput } from "@/shared/lib/dates";
import { fieldClass, useFieldControl } from "./Field";

/**
 * Data e hora no fuso de São Paulo. O valor é ISO em UTC (o que vai para a
 * API); o campo mostra e recebe a hora de Brasília, seja qual for o fuso do
 * navegador. Vazio vira null.
 */
export function DateTimeInput({
  value,
  onChange,
  onBlur,
  disabled = false,
  min,
  id,
  className,
  "aria-label": ariaLabel,
}: {
  value: string | null | undefined;
  onChange: (iso: string | null) => void;
  onBlur?: () => void;
  disabled?: boolean;
  /** ISO mínimo aceito pelo seletor (só sugestão; quem valida é o schema). */
  min?: string;
  id?: string;
  className?: string;
  "aria-label"?: string;
}) {
  const a11y = useFieldControl({ id });
  return (
    <input
      type="datetime-local"
      {...a11y}
      aria-label={ariaLabel}
      value={toZonedInput(value)}
      min={min ? toZonedInput(min) : undefined}
      disabled={disabled}
      onBlur={onBlur}
      onChange={(e) => onChange(e.target.value ? fromZonedInput(e.target.value) : null)}
      className={cn(fieldClass, "h-10 tabular-nums", className)}
    />
  );
}

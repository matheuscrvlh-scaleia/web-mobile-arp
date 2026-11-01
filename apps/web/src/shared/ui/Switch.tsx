import { Check } from "lucide-react";
import { type ComponentProps, type ReactNode, useId } from "react";
import { cn } from "@/shared/lib/cn";

/** Liga/desliga com rótulo clicável (role="switch"). */
export function Switch({
  checked,
  onCheckedChange,
  label,
  description,
  disabled = false,
  hideLabel = false,
  className,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  /** Rótulo só para leitores de tela (o contexto visual já diz o que é). */
  hideLabel?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={description ? `${id}-desc` : undefined}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          "relative mt-0.5 h-6 w-11 shrink-0 cursor-pointer rounded-full transition disabled:cursor-not-allowed disabled:opacity-50",
          checked ? "bg-marca-escuro" : "bg-neutral-300",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "absolute top-0.5 grid size-5 place-items-center rounded-full bg-[#fff] shadow transition-all",
            checked ? "left-[1.375rem]" : "left-0.5",
          )}
        >
          {checked && <Check className="size-3 text-marca-escuro" />}
        </span>
      </button>
      <span className={cn("min-w-0", hideLabel && "sr-only")}>
        <label htmlFor={id} className="block cursor-pointer text-sm font-medium text-neutral-800">
          {label}
        </label>
        {description && (
          <span id={`${id}-desc`} className="block text-xs text-neutral-500">
            {description}
          </span>
        )}
      </span>
    </div>
  );
}

/** Caixa de seleção nativa, redonda, com rótulo e descrição. */
export function Checkbox({
  label,
  description,
  className,
  ...props
}: Omit<ComponentProps<"input">, "type"> & { label: ReactNode; description?: ReactNode }) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 text-sm has-[:disabled]:cursor-default",
        className,
      )}
    >
      <input
        type="checkbox"
        {...props}
        className="peer mt-0.5 size-[1.125rem] shrink-0 cursor-pointer accent-neutral-900 disabled:cursor-default"
      />
      <span className="min-w-0">
        <span className="block text-neutral-800">{label}</span>
        {description && <span className="block text-xs text-neutral-500">{description}</span>}
      </span>
    </label>
  );
}

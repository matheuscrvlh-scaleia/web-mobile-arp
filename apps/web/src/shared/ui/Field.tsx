import { CircleAlert } from "lucide-react";
import { type AriaAttributes, createContext, type ReactNode, useContext, useId } from "react";
import { cn } from "@/shared/lib/cn";

interface FieldControl {
  id: string;
  describedBy: string | undefined;
  invalid: boolean;
  required: boolean;
}

const FieldContext = createContext<FieldControl | null>(null);

/**
 * Rótulo + controle + ajuda/erro. O controle dentro (Input, Select,
 * Textarea, ColorInput…) recebe id, aria-describedby e aria-invalid
 * sozinho pelo contexto.
 */
export function Field({
  label,
  hint,
  error,
  required = false,
  optional = false,
  action,
  className,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  /** Mostra "(opcional)" ao lado do rótulo. */
  optional?: boolean;
  /** Algo à direita do rótulo (ex.: contador de caracteres, link). */
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const id = useId();
  const hintId = `${id}-ajuda`;
  const errorId = `${id}-erro`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ");
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-xs font-medium text-neutral-600">
          {label}
          {required && (
            <span aria-hidden className="text-red-700">
              {" "}
              *
            </span>
          )}
          {optional && <span className="font-normal text-neutral-400"> (opcional)</span>}
        </label>
        {action && <span className="text-xs text-neutral-400">{action}</span>}
      </div>
      <FieldContext.Provider
        value={{ id, describedBy: describedBy || undefined, invalid: Boolean(error), required }}
      >
        {children}
      </FieldContext.Provider>
      {hint && (
        <p id={hintId} className="text-xs text-neutral-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="flex items-start gap-1 text-xs font-medium text-red-700">
          <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      )}
    </div>
  );
}

/** Props de acessibilidade do controle dentro de um <Field>. */
export function useFieldControl(own: {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: AriaAttributes["aria-invalid"];
}) {
  const ctx = useContext(FieldContext);
  return {
    id: own.id ?? ctx?.id,
    "aria-describedby": own["aria-describedby"] ?? ctx?.describedBy,
    "aria-invalid": own["aria-invalid"] ?? (ctx?.invalid || undefined),
    "aria-required": ctx?.required || undefined,
  };
}

/** Classe base dos campos (texto, select, textarea). */
export const fieldClass =
  "w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-900 focus:ring-4 focus:ring-neutral-900/5 disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-500 aria-[invalid=true]:border-red-500 aria-[invalid=true]:focus:ring-red-500/10";

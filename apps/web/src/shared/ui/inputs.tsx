import { ChevronDown, Search, X } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/shared/lib/cn";
import { fieldClass, useFieldControl } from "./Field";

export function Input({ className, ...props }: ComponentProps<"input">) {
  const a11y = useFieldControl(props);
  return <input {...props} {...a11y} className={cn(fieldClass, "h-10", className)} />;
}

export function Textarea({ className, rows = 4, ...props }: ComponentProps<"textarea">) {
  const a11y = useFieldControl(props);
  return (
    <textarea
      rows={rows}
      {...props}
      {...a11y}
      className={cn(fieldClass, "min-h-20 resize-y leading-relaxed", className)}
    />
  );
}

export interface SelectProps extends ComponentProps<"select"> {
  /** Primeira opção vazia (ex.: "Todas as categorias"). */
  placeholder?: string;
  children: ReactNode;
}

/** Select nativo (teclado, celular e leitor de tela de graça) com o visual do sistema. */
export function Select({ className, placeholder, children, ...props }: SelectProps) {
  const a11y = useFieldControl(props);
  return (
    <span className={cn("relative block", className)}>
      <select
        {...props}
        {...a11y}
        className={cn(fieldClass, "h-10 cursor-pointer appearance-none pr-9")}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-neutral-400"
      />
    </span>
  );
}

/** Busca das listagens: ícone, campo e botão de limpar. */
export function SearchInput({
  value,
  onChange,
  placeholder = "Buscar…",
  label = "Buscar",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Nome do campo para leitores de tela. */
  label?: string;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "flex h-10 min-w-0 items-center gap-2 rounded-full border border-neutral-200 bg-white py-1 pr-1.5 pl-1.5 text-sm transition focus-within:border-neutral-900 focus-within:ring-4 focus-within:ring-neutral-900/5",
        className,
      )}
    >
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-neutral-900 text-white">
        <Search className="size-3.5" aria-hidden />
      </span>
      <span className="sr-only">{label}</span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-neutral-900 outline-none placeholder:text-neutral-400 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Limpar busca"
          className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-full text-neutral-400 hover:bg-neutral-900/[0.06] hover:text-neutral-900"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      )}
    </label>
  );
}

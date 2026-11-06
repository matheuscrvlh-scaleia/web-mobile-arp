import { ChevronDown } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import { cn } from "@/shared/lib/cn";

/**
 * "Mais opções": campos raros recolhidos. Abre sozinho quando já tem algo
 * preenchido (`defaultOpen`) ou quando um campo de dentro tem erro (`forceOpen`).
 */
export function MoreOptions({
  label = "Mais opções",
  summary,
  defaultOpen = false,
  forceOpen = false,
  children,
  className,
}: {
  label?: string;
  /** O que tem dentro, em uma linha (ex.: "Loja, evento, período próprio"). */
  summary?: string;
  defaultOpen?: boolean;
  forceOpen?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  const shown = open || forceOpen;
  return (
    <div className={cn("rounded-3xl border border-neutral-900/[0.08]", className)}>
      <button
        type="button"
        aria-expanded={shown}
        aria-controls={id}
        onClick={() => setOpen(!shown)}
        className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-3xl px-4 py-2.5 text-left hover:bg-neutral-900/[0.03]"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-neutral-900">{label}</span>
          {summary && !shown && (
            <span className="block truncate text-xs text-neutral-500">{summary}</span>
          )}
        </span>
        <ChevronDown
          className={cn("size-4 shrink-0 text-neutral-500 transition", shown && "rotate-180")}
          aria-hidden
        />
      </button>
      <div id={id} hidden={!shown} className="flex flex-col gap-4 px-4 pt-2 pb-4">
        {children}
      </div>
    </div>
  );
}

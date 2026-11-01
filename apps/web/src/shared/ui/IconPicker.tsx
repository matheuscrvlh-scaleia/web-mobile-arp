import { Pencil } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { ICONS, iconFor } from "@/shared/lib/icons";
import { useFieldControl } from "./Field";

// A grade com busca (e os nomes em português) só carrega quando abre.
const IconPickerDialog = lazy(() => import("./IconPickerDialog"));

/**
 * Escolha de ícone (nome do lucide em kebab-case, o que vai para o banco).
 * Mostra o atual sobre a cor de prévia; a lista abre num modal com busca em
 * português ("cerveja" acha beer).
 */
export function IconPicker({
  value,
  onChange,
  color,
  disabled = false,
  id,
}: {
  value: string;
  onChange: (name: string) => void;
  /** Cor de fundo da prévia (ex.: a cor da loja). */
  color?: string;
  disabled?: boolean;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const a11y = useFieldControl({ id });
  const Icon = iconFor(value);
  const known = value in ICONS;
  return (
    <>
      <button
        type="button"
        {...a11y}
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="group flex h-12 w-full max-w-xs cursor-pointer items-center gap-3 rounded-xl border border-neutral-200 bg-white px-2 text-left transition hover:border-neutral-400 disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-red-500"
      >
        <span
          className="grid size-8 shrink-0 place-items-center rounded-lg text-[#fff]"
          style={{ backgroundColor: color ?? "#141714" }}
        >
          <Icon className="size-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-mono text-sm text-neutral-900">
            {value || "Escolher ícone"}
          </span>
          {value && !known && (
            <span className="block text-[11px] text-amber-900">Fora da lista do app</span>
          )}
        </span>
        <Pencil className="mr-1 size-4 text-neutral-400 group-hover:text-neutral-900" aria-hidden />
        <span className="sr-only">Trocar ícone</span>
      </button>
      {open && (
        <Suspense>
          <IconPickerDialog
            value={value}
            onClose={() => setOpen(false)}
            onPick={(name) => {
              onChange(name);
              setOpen(false);
            }}
          />
        </Suspense>
      )}
    </>
  );
}

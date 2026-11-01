import { Check } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/shared/lib/cn";
import { ICON_KEYWORDS } from "@/shared/lib/icon-keywords";
import { ICON_GROUPS, iconFor } from "@/shared/lib/icons";
import { normalize } from "@/shared/lib/text";
import { Button } from "./Button";
import { SearchInput } from "./inputs";
import { Modal } from "./Modal";

/** Grade de ícones com busca em português ("cerveja" acha beer). Carregada sob demanda. */
export default function IconPickerDialog({
  value,
  onClose,
  onPick,
}: {
  value: string;
  onClose: () => void;
  onPick: (name: string) => void;
}) {
  const [query, setQuery] = useState("");
  const groups = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return ICON_GROUPS.map((g) => ({ label: g.label, names: Object.keys(g.icons) }));
    return ICON_GROUPS.map((g) => ({
      label: g.label,
      names: Object.keys(g.icons).filter((n) =>
        normalize(`${n} ${ICON_KEYWORDS[n] ?? ""}`).includes(q),
      ),
    })).filter((g) => g.names.length > 0);
  }, [query]);

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Escolher ícone"
      description="Os mesmos ícones que o app do visitante desenha."
      footer={
        <Button variant="secondary" onClick={onClose}>
          Fechar
        </Button>
      }
    >
      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Buscar (ex.: café, pet, estacionamento)"
        label="Buscar ícone"
        className="mb-4"
      />
      {groups.length === 0 && (
        <p className="py-8 text-center text-sm text-neutral-500">Nenhum ícone encontrado.</p>
      )}
      <div className="flex flex-col gap-5 pb-2">
        {groups.map((g) => (
          <fieldset key={g.label}>
            <legend className="mb-2 text-xs font-medium tracking-wider text-neutral-400 uppercase">
              {g.label}
            </legend>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-1.5">
              {g.names.map((name) => {
                const Icon = iconFor(name);
                const on = name === value;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => onPick(name)}
                    aria-pressed={on}
                    title={name}
                    className={cn(
                      "relative flex cursor-pointer flex-col items-center gap-1 rounded-2xl px-1 py-2.5 text-neutral-700 transition hover:bg-neutral-900/[0.06]",
                      on && "bg-neutral-900 text-white hover:bg-neutral-900",
                    )}
                  >
                    <Icon className="size-5" aria-hidden />
                    <span className="w-full truncate text-center text-[10px]">{name}</span>
                    {on && (
                      <Check className="absolute top-1 right-1 size-3 text-marca" aria-hidden />
                    )}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>
    </Modal>
  );
}

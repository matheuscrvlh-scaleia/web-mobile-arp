import type { Floor } from "@arp/contracts";
import { useId } from "react";
import { cn } from "@/shared/lib/cn";

/**
 * Seletor de andar "como elevador" (igual ao app): botões redondos com a
 * sigla, o andar mais alto em cima. São rádios nativos escondidos, então
 * as setas trocam de andar e o leitor de tela anuncia o nome completo.
 */
export function FloorElevator({
  floors,
  value,
  onChange,
  orientation = "vertical",
}: {
  floors: Floor[];
  value: string | undefined;
  onChange: (floorId: string) => void;
  orientation?: "vertical" | "horizontal";
}) {
  const name = useId();
  // Elevador: o mais alto no topo.
  const ordered = orientation === "vertical" ? [...floors].reverse() : floors;

  return (
    <fieldset
      className={cn(
        "inline-flex gap-1 rounded-[1.6rem] bg-white p-1.5 shadow-[0_16px_30px_-14px_rgb(0_0_0/0.35)]",
        orientation === "vertical" ? "flex-col" : "flex-row",
      )}
    >
      <legend className="sr-only">Andar</legend>
      {ordered.map((f) => {
        const on = f.id === value;
        return (
          <label
            key={f.id}
            title={f.label}
            className={cn(
              "grid size-11 cursor-pointer place-items-center rounded-full text-base font-bold transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-neutral-900/50",
              on
                ? "bg-neutral-900 text-white"
                : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900",
            )}
          >
            <input
              type="radio"
              name={name}
              value={f.id}
              checked={on}
              onChange={() => onChange(f.id)}
              className="sr-only"
            />
            <span aria-hidden>{f.shortLabel}</span>
            <span className="sr-only">{f.label}</span>
          </label>
        );
      })}
    </fieldset>
  );
}

import { type Tone, toneSchema } from "@arp/contracts";
import { Check } from "lucide-react";
import { useId } from "react";
import { cn } from "@/shared/lib/cn";

export const TONE_LABEL: Record<Tone, string> = {
  green: "Verde",
  ink: "Tinta",
  clay: "Argila",
  sand: "Areia",
  deep: "Mata",
};

/**
 * Tom do cartão do app (cupons, eventos sem foto): rádios nativos com a
 * amostra do degradê e o nome (a cor não vem sozinha).
 */
export function TonePicker({
  value,
  onChange,
  label = "Tom do cartão",
  disabled = false,
}: {
  value: Tone | null | undefined;
  onChange: (tone: Tone) => void;
  label?: string;
  disabled?: boolean;
}) {
  const name = useId();
  return (
    <fieldset className="flex flex-wrap gap-2" disabled={disabled}>
      <legend className="sr-only">{label}</legend>
      {toneSchema.options.map((t) => {
        const on = t === value;
        return (
          <label
            key={t}
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-full border border-neutral-200 bg-white py-1 pr-3 pl-1 text-sm text-neutral-700 transition hover:border-neutral-400 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-neutral-900/50 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60",
              on && "border-neutral-900 font-medium text-neutral-900",
            )}
          >
            <input
              type="radio"
              name={name}
              value={t}
              checked={on}
              onChange={() => onChange(t)}
              className="sr-only"
            />
            <span
              aria-hidden
              className={cn(
                `tom-app-${t}`,
                "grid size-7 place-items-center rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.08)]",
              )}
            >
              {on && <Check className="size-3.5" />}
            </span>
            {TONE_LABEL[t]}
          </label>
        );
      })}
    </fieldset>
  );
}

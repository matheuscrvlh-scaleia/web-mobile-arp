import { Check } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { fieldClass, useFieldControl } from "./Field";

/** Cores das lojas do app (protótipo), para começar com algo que combina. */
export const BRAND_SWATCHES = [
  "#2f7d3d",
  "#58c069",
  "#c8692f",
  "#b8452e",
  "#d0607a",
  "#7d5a8c",
  "#4a5d8a",
  "#2b4c6f",
  "#3c6e71",
  "#6b7f4e",
  "#8a7a5c",
  "#a0743a",
  "#7a5233",
  "#3a3a3a",
] as const;

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Cor em #RRGGBB: amostras prontas, seletor nativo e o código editável. */
export function ColorInput({
  value,
  onChange,
  onBlur,
  disabled = false,
  swatches = BRAND_SWATCHES,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  swatches?: readonly string[];
  id?: string;
}) {
  const a11y = useFieldControl({ id });
  const valid = HEX.test(value);
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <label
          className={cn(
            "relative grid size-10 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-xl border border-neutral-200 shadow-inner",
            disabled && "cursor-not-allowed opacity-60",
          )}
          style={{ backgroundColor: valid ? value : "transparent" }}
        >
          <span className="sr-only">Escolher no seletor de cores</span>
          <input
            type="color"
            value={valid ? value.toLowerCase() : "#000000"}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
        <input
          {...a11y}
          value={value}
          disabled={disabled}
          onBlur={onBlur}
          onChange={(e) => {
            const v = e.target.value.trim();
            onChange(v.startsWith("#") || v === "" ? v : `#${v}`);
          }}
          maxLength={7}
          spellCheck={false}
          placeholder="#2f7d3d"
          className={cn(fieldClass, "h-10 w-32 font-mono uppercase")}
        />
      </div>
      <fieldset className="flex flex-wrap gap-1.5" disabled={disabled}>
        <legend className="sr-only">Cores sugeridas</legend>
        {swatches.map((c) => {
          const on = valid && c.toLowerCase() === value.toLowerCase();
          return (
            <button
              key={c}
              type="button"
              onClick={() => onChange(c)}
              aria-label={`Cor ${c}`}
              aria-pressed={on}
              className={cn(
                "grid size-7 cursor-pointer place-items-center rounded-full ring-offset-2 ring-offset-transparent transition hover:scale-110 disabled:cursor-not-allowed",
                on && "ring-2 ring-neutral-900",
              )}
              style={{ backgroundColor: c }}
            >
              {on && <Check className="size-3.5 text-[#fff]" aria-hidden />}
            </button>
          );
        })}
      </fieldset>
    </div>
  );
}

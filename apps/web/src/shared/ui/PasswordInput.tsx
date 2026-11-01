import { Eye, EyeOff } from "lucide-react";
import { type ComponentProps, useState } from "react";
import { cn } from "@/shared/lib/cn";
import { fieldClass, useFieldControl } from "./Field";

/** Campo de senha com "mostrar/ocultar". */
export function PasswordInput({ className, ...props }: Omit<ComponentProps<"input">, "type">) {
  const [visible, setVisible] = useState(false);
  const a11y = useFieldControl(props);
  return (
    <span className="relative block">
      <input
        {...props}
        {...a11y}
        type={visible ? "text" : "password"}
        className={cn(fieldClass, "h-11 pr-11", className)}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
        aria-pressed={visible}
        className="absolute inset-y-0 right-1.5 my-auto grid size-8 cursor-pointer place-items-center rounded-lg text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900"
      >
        {visible ? (
          <EyeOff className="size-4" aria-hidden />
        ) : (
          <Eye className="size-4" aria-hidden />
        )}
      </button>
    </span>
  );
}

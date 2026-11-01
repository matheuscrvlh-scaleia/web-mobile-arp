import type { LucideIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

/**
 * Variante do cartão. Os tons escuro e verde redefinem a escala de cinzas
 * por dentro (globals.css, .tom-*): texto, tabelas e gráficos se ajustam
 * sozinhos. Não troque fundo/texto pelo className: use a variante.
 */
const VARIANTS = {
  glass: "vidro text-neutral-900",
  dark: "tom-escuro",
  green: "tom-verde",
  dashed:
    "border border-dashed border-neutral-900/15 bg-white/25 text-neutral-500 backdrop-blur-xl",
} as const;
export type CardVariant = keyof typeof VARIANTS;

const PADDINGS = { none: "", sm: "p-4", md: "p-5 md:p-6", lg: "p-6 md:p-8" } as const;

export interface CardProps extends ComponentProps<"div"> {
  variant?: CardVariant;
  padding?: keyof typeof PADDINGS;
  /** Sobe um pouco ao passar o mouse (cartões clicáveis). */
  hover?: boolean;
}

export function Card({
  variant = "glass",
  padding = "md",
  hover = false,
  className,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "relative min-w-0 rounded-[1.75rem]",
        VARIANTS[variant],
        PADDINGS[padding],
        hover && "flutua",
        className,
      )}
      {...props}
    />
  );
}

/** Cabeçalho de cartão: título, explicação curta e ação à direita. */
export function CardHeader({
  title,
  description,
  icon: Icon,
  action,
  id,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  action?: ReactNode;
  /** Para aria-labelledby da seção. */
  id?: string;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-neutral-900/[0.06] text-neutral-700">
            <Icon className="size-4" aria-hidden />
          </span>
        )}
        <div className="min-w-0">
          <h2 id={id} className="text-base font-semibold tracking-tight text-neutral-900">
            {title}
          </h2>
          {description && <p className="mt-0.5 text-xs text-neutral-500">{description}</p>}
        </div>
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}

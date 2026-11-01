import { Inbox, type LucideIcon, RotateCw, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { errorMessage } from "@/shared/api";
import { cn } from "@/shared/lib/cn";
import { Button } from "./Button";

/** Nada para mostrar (lista vazia, filtro sem resultado), com o próximo passo. */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  compact = false,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  /** Versão baixa para dentro de cartões e tabelas. */
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center text-center",
        compact ? "px-4 py-8" : "px-6 py-14",
        className,
      )}
    >
      <span
        className={cn(
          "grid place-items-center rounded-full bg-neutral-900 text-white shadow-[0_0_0_8px_rgb(0_0_0/0.05)]",
          compact ? "size-11" : "size-14",
        )}
      >
        <Icon className={compact ? "size-5" : "size-6"} aria-hidden />
      </span>
      <p className={cn("font-semibold text-neutral-900", compact ? "mt-4" : "mt-5 text-lg")}>
        {title}
      </p>
      {description && (
        <p className="mx-auto mt-1.5 max-w-md text-sm text-neutral-500">{description}</p>
      )}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

/** Falha ao carregar: mostra a mensagem da API e oferece tentar de novo. */
export function ErrorState({
  error,
  onRetry,
  title = "Não deu para carregar",
  compact = false,
  className,
}: {
  error: unknown;
  onRetry?: () => void;
  title?: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center text-center",
        compact ? "px-4 py-8" : "px-6 py-14",
        className,
      )}
    >
      <span className="grid size-12 place-items-center rounded-full bg-red-500/15 text-red-700">
        <TriangleAlert className="size-5" aria-hidden />
      </span>
      <p className="mt-4 font-semibold text-neutral-900">{title}</p>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-neutral-500">{errorMessage(error)}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" icon={RotateCw} className="mt-5" onClick={onRetry}>
          Tentar de novo
        </Button>
      )}
    </div>
  );
}

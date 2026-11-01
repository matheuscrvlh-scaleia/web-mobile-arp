import type { Permission } from "@arp/contracts";
import { Check, Copy, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useAuth } from "@/shared/auth";
import { useCopyToClipboard } from "@/shared/hooks";
import { cn } from "@/shared/lib/cn";
import { initials } from "@/shared/lib/format";

/**
 * Mostra o conteúdo só para quem tem a permissão (ou uma das `anyOf`). É
 * conveniência de interface: quem garante é a API.
 */
export function Can({
  permission,
  anyOf,
  fallback = null,
  children,
}: {
  permission?: Permission;
  anyOf?: readonly Permission[];
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const { can, canAny } = useAuth();
  const allowed = (permission ? can(permission) : true) && (anyOf ? canAny(anyOf) : true);
  return allowed ? children : fallback;
}

export function Avatar({
  name,
  muted = false,
  size = "md",
}: {
  name: string;
  muted?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-semibold",
        size === "sm" && "size-8 text-xs",
        size === "md" && "size-10 text-sm",
        size === "lg" && "size-14 text-lg",
        muted ? "bg-neutral-200 text-neutral-500" : "bg-violet-100 text-violet-700",
      )}
    >
      {initials(name)}
    </span>
  );
}

/** Botão de copiar com retorno ("Copiado"). */
export function CopyButton({
  value,
  label = "Copiar",
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, copy] = useCopyToClipboard();
  return (
    <button
      type="button"
      onClick={() => void copy(value)}
      className={cn(
        "inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 text-sm text-neutral-700 transition hover:border-neutral-400",
        className,
      )}
    >
      {copied ? (
        <Check className="size-4 text-green-700" aria-hidden />
      ) : (
        <Copy className="size-4" aria-hidden />
      )}
      <span aria-live="polite">{copied ? "Copiado" : label}</span>
    </button>
  );
}

/** Rótulo + valor, para blocos de leitura (detalhes). */
export function InfoItem({
  label,
  children,
  icon: Icon,
}: {
  label: string;
  children: ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      {Icon && (
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-neutral-900/[0.05] text-neutral-600">
          <Icon className="size-4" aria-hidden />
        </span>
      )}
      <div className="min-w-0">
        <p className="text-xs text-neutral-500">{label}</p>
        <div className="truncate text-sm font-medium text-neutral-900">{children}</div>
      </div>
    </div>
  );
}

/** Linha de filtros acima das listas. */
export function FilterBar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mb-4 flex flex-wrap items-center gap-2", className)}>{children}</div>;
}

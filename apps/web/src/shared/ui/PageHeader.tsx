import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { useDocumentTitle } from "@/shared/hooks";
import { cn } from "@/shared/lib/cn";

/**
 * Título da tela (também vira o título da aba do navegador), explicação
 * curta e as ações principais à direita.
 */
export function PageHeader({
  title,
  description,
  actions,
  back,
  documentTitle,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** Link de volta acima do título (telas de detalhe). */
  back?: { to: string; label: string };
  /** Título da aba quando `title` não é texto. */
  documentTitle?: string;
  className?: string;
}) {
  useDocumentTitle(documentTitle ?? (typeof title === "string" ? title : null));
  return (
    <header
      data-guia="titulo"
      className={cn("mb-6 flex flex-wrap items-end justify-between gap-4", className)}
    >
      <div className="min-w-0">
        {back && (
          <Link
            to={back.to}
            className="mb-3 inline-flex items-center gap-1.5 rounded-full text-sm text-neutral-500 transition hover:text-neutral-900"
          >
            <ArrowLeft className="size-4" aria-hidden />
            {back.label}
          </Link>
        )}
        <h1 className="text-4xl font-semibold tracking-tight text-balance text-neutral-900 md:text-5xl">
          {title}
        </h1>
        {description && <p className="mt-3 max-w-3xl text-sm text-neutral-500">{description}</p>}
      </div>
      {actions && (
        <div data-guia="acoes" className="flex flex-wrap items-center gap-2">
          {actions}
        </div>
      )}
    </header>
  );
}

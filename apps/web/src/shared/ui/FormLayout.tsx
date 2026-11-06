import { RotateCcw, Save } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";
import { Button } from "./Button";

/**
 * Bloco de formulário: título e explicação à esquerda, campos à direita.
 * Vários seguidos ficam separados por uma linha.
 */
export function FormSection({
  title,
  description,
  children,
  wide = false,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  /** Título em cima e conteúdo na largura toda, em vez de lado a lado. */
  wide?: boolean;
}) {
  return (
    <section
      className={cn(
        "grid grid-cols-1 gap-4 border-neutral-200/70 py-6 not-first-of-type:border-t first-of-type:pt-0 last-of-type:pb-0",
        !wide && "md:grid-cols-[15rem_minmax(0,1fr)] md:gap-8",
      )}
    >
      <div>
        <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
        {description && <p className="mt-1 text-xs text-neutral-500">{description}</p>}
      </div>
      <div className="flex min-w-0 flex-col gap-4">{children}</div>
    </section>
  );
}

/** Grade de campos lado a lado (quebra para uma coluna no celular). */
export function FieldRow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2", className)}>{children}</div>;
}

/**
 * Barra de salvar: gruda no pé da tela enquanto há alterações, com
 * "Desfazer" para voltar ao que estava salvo. Só o botão (criação, nada
 * alterado ainda): sem a pílula escura em volta.
 */
export function SaveBar({
  dirty,
  saving,
  onReset,
  submitLabel = "Salvar alterações",
  disabled = false,
  alwaysVisible = false,
  besidePreview = false,
}: {
  dirty: boolean;
  saving: boolean;
  onReset?: () => void;
  submitLabel?: string;
  disabled?: boolean;
  /** Formulários de criação: botão sempre visível, mesmo sem alteração. */
  alwaysVisible?: boolean;
  /**
   * Formulário com a prévia do app numa coluna de ~20rem à direita (xl): a
   * barra fica na coluna do formulário, sem cobrir a prévia.
   */
  besidePreview?: boolean;
}) {
  if (!dirty && !alwaysVisible) return null;
  const note = dirty && !alwaysVisible;
  const undo = Boolean(onReset) && dirty;
  const submit = (
    <Button
      type="submit"
      variant="brand"
      icon={Save}
      loading={saving}
      disabled={disabled}
      className={cn(!note && !undo && "pointer-events-auto shadow-lg")}
    >
      {submitLabel}
    </Button>
  );
  return (
    // A faixa inteira é transparente a cliques: só a pílula/botão recebe.
    <div
      className={cn(
        "pointer-events-none sticky bottom-3 z-20 mt-6 flex justify-end",
        besidePreview && "xl:pr-[21.5rem]",
      )}
    >
      {!note && !undo ? (
        submit
      ) : (
        <div
          className={cn(
            "fume pointer-events-auto flex flex-wrap items-center gap-2 rounded-full py-1.5 pr-1.5",
            note ? "pl-5" : "pl-1.5",
          )}
        >
          {note && (
            <span className="mr-2 text-sm text-[rgb(255_255_255/0.8)]">Alterações não salvas</span>
          )}
          {undo && (
            <button
              type="button"
              onClick={onReset}
              disabled={saving}
              className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full px-4 text-sm text-[rgb(255_255_255/0.85)] transition hover:bg-[rgb(255_255_255/0.1)] disabled:opacity-50"
            >
              <RotateCcw className="size-4" aria-hidden />
              Desfazer
            </button>
          )}
          {submit}
        </div>
      )}
    </div>
  );
}

/** Mensagem de erro geral do formulário (o que não é de um campo só). */
export function FormError({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
      {message}
    </p>
  );
}

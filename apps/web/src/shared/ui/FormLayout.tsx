import { type LucideIcon, RotateCcw, Save } from "lucide-react";
import { type ReactNode, useEffect } from "react";
import { useIsMobile } from "@/shared/hooks";
import { cn } from "@/shared/lib/cn";
import { slugify } from "@/shared/lib/text";
import { Button } from "./Button";
import { registerBottomBar } from "./Toast";

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
      data-guia={`secao-${slugify(title)}`}
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

/** Segundo botão da barra (ex.: "Salvar rascunho" ao lado de "Publicar"). */
export interface SaveBarSecondary {
  label: string;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: LucideIcon;
}

/**
 * Barra de salvar: gruda no pé da tela enquanto há alterações, com
 * "Desfazer" para voltar ao que estava salvo. Só o botão (criação, nada
 * alterado ainda): sem a pílula escura em volta. No celular vira uma barra
 * fixa de largura toda, e um espaço do mesmo tamanho no fim do formulário
 * garante que ela nunca cubra o último campo. Os avisos (toasts) sobem
 * enquanto ela está na tela.
 */
export function SaveBar({
  dirty,
  saving,
  onReset,
  submitLabel = "Salvar alterações",
  submitIcon = Save,
  disabled = false,
  alwaysVisible = false,
  besidePreview = false,
  secondary,
}: {
  dirty: boolean;
  saving: boolean;
  onReset?: () => void;
  submitLabel?: string;
  /** Ícone do botão principal (padrão: disquete). Ex.: Send para "Publicar". */
  submitIcon?: LucideIcon;
  disabled?: boolean;
  /** Formulários de criação: botão sempre visível, mesmo sem alteração. */
  alwaysVisible?: boolean;
  /**
   * Formulário com a prévia do app numa coluna de ~20rem à direita (xl): a
   * barra fica na coluna do formulário, sem cobrir a prévia.
   */
  besidePreview?: boolean;
  /**
   * Botão secundário antes do principal (type="button"), ex.: telas de
   * criação com "Salvar rascunho" + "Publicar" (o principal é o submit).
   */
  secondary?: SaveBarSecondary;
}) {
  const visible = dirty || alwaysVisible;
  const mobile = useIsMobile();
  useEffect(() => (visible ? registerBottomBar() : undefined), [visible]);
  if (!visible) return null;
  const note = dirty && !alwaysVisible;
  const undo = Boolean(onReset) && dirty;
  const busy = saving || Boolean(secondary?.loading);

  const secondaryButton = secondary && (
    <Button
      variant="secondary"
      icon={secondary.icon}
      loading={secondary.loading}
      disabled={secondary.disabled || saving}
      onClick={secondary.onClick}
      className={mobile ? "h-11 flex-1" : undefined}
    >
      {secondary.label}
    </Button>
  );
  const submit = (
    <Button
      type="submit"
      variant="brand"
      icon={submitIcon}
      loading={saving}
      disabled={disabled || Boolean(secondary?.loading)}
      className={cn(
        mobile ? "h-11 flex-1" : !note && !undo && !secondary && "pointer-events-auto shadow-lg",
      )}
    >
      {submitLabel}
    </Button>
  );
  const undoButton = undo && (
    <button
      type="button"
      onClick={onReset}
      disabled={busy}
      className={cn(
        "inline-flex cursor-pointer items-center gap-2 rounded-full text-sm transition disabled:opacity-50",
        mobile
          ? "h-11 px-3 text-neutral-600 hover:bg-neutral-900/[0.06]"
          : "h-10 px-4 text-[rgb(255_255_255/0.85)] hover:bg-[rgb(255_255_255/0.1)]",
      )}
    >
      <RotateCcw className="size-4" aria-hidden />
      Desfazer
    </button>
  );

  if (mobile) {
    return (
      <>
        {/* Espaço no fim do formulário do tamanho da barra fixa. */}
        <div aria-hidden className="h-24" />
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-white px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-12px_32px_-20px_rgb(0_0_0/0.35)]">
          {note && <p className="mb-2 text-xs text-neutral-500">Alterações não salvas</p>}
          <div className="flex items-center gap-2">
            {undoButton}
            {secondaryButton}
            {submit}
          </div>
        </div>
      </>
    );
  }

  return (
    // A faixa inteira é transparente a cliques: só a pílula/botão recebe.
    <div
      className={cn(
        "pointer-events-none sticky bottom-3 z-20 mt-6 flex justify-end",
        besidePreview && "xl:pr-[21.5rem]",
      )}
    >
      {!note && !undo && !secondary ? (
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
          {undoButton}
          {secondaryButton}
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

import { CircleAlert, CircleHelp, CircleX, X } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { errorMessage } from "@/shared/api";
import { cn } from "@/shared/lib/cn";
import { Button } from "./Button";

// Modal padrão: <dialog> nativo (Esc fecha, foco preso dentro, fundo
// inerte), no <body> para não herdar o tom do cartão de onde saiu. Só
// existe enquanto aberto: abre ao montar e devolve o foco ao sair.

const SIZES = {
  sm: "w-[min(28rem,calc(100vw-1.5rem))]",
  md: "w-[min(36rem,calc(100vw-1.5rem))]",
  lg: "w-[min(48rem,calc(100vw-1.5rem))]",
  xl: "w-[min(64rem,calc(100vw-1.5rem))]",
} as const;

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** Botões do rodapé (o primeiro no DOM recebe o foco se nada pedir autoFocus). */
  footer?: ReactNode;
  size?: keyof typeof SIZES;
  /** Enquanto true, Esc, clique fora e o X não fecham (ex.: salvando). */
  busy?: boolean;
  /** Papel de alerta (erros e confirmações perigosas). */
  alert?: boolean;
}

export function Modal(props: ModalProps) {
  if (!props.open) return null;
  return createPortal(<ModalPanel {...props} />, document.body);
}

function ModalPanel({
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  busy = false,
  alert = false,
}: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = ref.current;
    // StrictMode monta duas vezes: não reabre o que já está aberto.
    if (dialog && !dialog.open) dialog.showModal();
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = overflow;
      previous?.focus();
    };
  }, []);

  const close = () => {
    if (!busy) onClose();
  };

  return (
    <dialog
      ref={ref}
      role={alert ? "alertdialog" : undefined}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      aria-busy={busy || undefined}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      onKeyDown={() => undefined}
      className={cn(
        "modal m-auto max-h-[calc(100dvh-1.5rem)] overflow-visible rounded-[2rem] border-0 bg-transparent p-0 text-neutral-900 backdrop:bg-black/45 backdrop:backdrop-blur-md",
        SIZES[size],
      )}
    >
      <div className="painel-modal relative isolate flex max-h-[calc(100dvh-1.5rem)] flex-col overflow-hidden rounded-[2rem]">
        <div
          aria-hidden
          className={cn(
            "absolute -top-16 -right-10 -z-10 h-32 w-2/3 rounded-full blur-3xl",
            alert ? "bg-red-500/20" : "bg-marca/25",
          )}
        />
        <header className="flex items-start gap-3 px-6 pt-6 md:px-7 md:pt-7">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-lg font-semibold tracking-tight text-balance">
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-1 text-sm text-neutral-600">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={close}
            disabled={busy}
            aria-label="Fechar"
            className="-mt-1 -mr-2 grid size-9 shrink-0 cursor-pointer place-items-center rounded-full text-neutral-500 transition hover:bg-neutral-900/[0.07] hover:text-neutral-900 disabled:opacity-50"
          >
            <X className="size-4" aria-hidden />
          </button>
        </header>
        {children && (
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-5 pb-1 md:px-7">{children}</div>
        )}
        {footer && (
          <footer className="flex flex-col-reverse gap-2 px-6 pt-5 pb-6 sm:flex-row sm:justify-end md:px-7 md:pb-7">
            {footer}
          </footer>
        )}
        {!footer && <div className="h-6" />}
      </div>
    </dialog>
  );
}

/**
 * Confirmação (apagar, desativar…). Fica aberta enquanto a ação roda; se
 * ela falhar, o erro aparece aqui mesmo, com "Tentar de novo".
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  danger = false,
  loading = false,
  error,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  loading?: boolean;
  /** Erro da última tentativa (ex.: mutation.error). */
  error?: unknown;
}) {
  const hasError = error !== null && error !== undefined;
  const Icon = hasError ? CircleX : danger ? CircleAlert : CircleHelp;
  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={loading}
      alert={danger || hasError}
      size="sm"
      title={
        <span className="flex flex-col gap-4">
          <span
            aria-hidden
            className={cn(
              "grid size-11 place-items-center rounded-full",
              danger || hasError
                ? "bg-red-500/15 text-red-700"
                : "bg-neutral-900/[0.06] text-neutral-800",
            )}
          >
            <Icon className="size-5" />
          </span>
          {hasError ? "Não deu para concluir" : title}
        </span>
      }
      description={hasError ? errorMessage(error) : description}
      footer={
        <>
          {/* Cancelar vem antes no DOM: é ele que recebe o foco ao abrir. */}
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {hasError ? "Fechar" : "Cancelar"}
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} loading={loading}>
            {hasError ? "Tentar de novo" : confirmLabel}
          </Button>
        </>
      }
    />
  );
}

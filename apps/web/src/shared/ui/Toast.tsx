import { CircleCheck, CircleX, Info, type LucideIcon, Undo2, X } from "lucide-react";
import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { errorMessage } from "@/shared/api";
import { cn } from "@/shared/lib/cn";
import { UpdateNotice } from "./UpdateNotice";

// Avisos rápidos no canto inferior direito: o retorno das ações ("Loja
// salva.", erros). Sucesso some sozinho; erro fica mais tempo. Um
// <Toaster /> só, nos providers; qualquer lugar chama toast.success().
// Com `action` vira o padrão "aplica na hora + Desfazer":
//   toast.success("Desafio pausado", { action: { label: "Desfazer", onClick: retomar } })

export type ToastKind = "success" | "error" | "info";

export interface ToastOptions {
  /** Botão no aviso (ex.: "Desfazer"). Clicar roda a ação e fecha o aviso. */
  action?: { label: string; onClick: () => void };
  /** Tempo na tela em ms (padrão: 4,5 s sucesso, 6 s aviso, 9 s erro, 8 s com ação). */
  duration?: number;
  /**
   * Item a que o aviso se refere (ex.: "campanha:<id>"). Um aviso novo com a
   * mesma chave fecha o anterior: um "Desfazer" velho não volta o item para
   * um estado que já não é o de antes.
   */
  key?: string;
}

interface ToastItem {
  id: number;
  kind: ToastKind;
  key?: string;
  text: string;
  action?: ToastOptions["action"];
  leaving?: boolean;
}

const DURATION_MS: Record<ToastKind, number> = { success: 4500, info: 6000, error: 9000 };
const ACTION_MS = 8000;
const LEAVE_MS = 220;
const MAX = 4;

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const EMPTY: ToastItem[] = [];

function update(fn: (l: ToastItem[]) => ToastItem[]) {
  items = fn(items);
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function dismiss(id: number) {
  update((l) => l.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
  setTimeout(() => update((l) => l.filter((t) => t.id !== id)), LEAVE_MS);
}

/** Mostra o aviso e devolve o id (para `toast.dismiss(id)`). */
function show(kind: ToastKind, text: string, options: ToastOptions = {}): number {
  // Sessão expirada: a tela de login já explica (com o rascunho guardado). Sem toast repetido.
  if (kind === "error" && /^sua sess[aã]o (expirou|terminou)/i.test(text)) return -1;
  const id = nextId++;
  const { action, duration, key } = options;
  // A mesma mensagem repetida (ou a mesma chave) troca a anterior em vez de empilhar.
  update((l) =>
    [
      ...l.filter((t) => !(t.kind === kind && t.text === text) && !(key && t.key === key)),
      { id, kind, key, text, action },
    ].slice(-MAX),
  );
  const base = duration ?? (action ? ACTION_MS : DURATION_MS[kind]);
  const ms = duration ?? Math.min(Math.max(base, text.length * 60), 15_000);
  setTimeout(() => dismiss(id), ms);
  return id;
}

export const toast = {
  success: (text: string, options?: ToastOptions) => show("success", text, options),
  info: (text: string, options?: ToastOptions) => show("info", text, options),
  error: (text: string, options?: ToastOptions) => show("error", text, options),
  /** Mensagem amigável de qualquer erro (ApiError traz a do servidor). */
  fromError: (e: unknown, options?: ToastOptions) => show("error", errorMessage(e), options),
  dismiss,
};

// Barra fixa no pé da tela (SaveBar): enquanto houver uma, os avisos sobem
// para não cobrir o botão de salvar.
let bottomBars = 0;
const barListeners = new Set<() => void>();

function subscribeBars(listener: () => void) {
  barListeners.add(listener);
  return () => barListeners.delete(listener);
}

/** Marca que há uma barra fixa no pé (chamar num efeito; devolve a limpeza). */
export function registerBottomBar(): () => void {
  bottomBars++;
  for (const l of barListeners) l();
  return () => {
    bottomBars--;
    for (const l of barListeners) l();
  };
}

const STYLE: Record<ToastKind, { icon: LucideIcon; className: string; label: string }> = {
  success: { icon: CircleCheck, className: "bg-green-400/20 text-green-700", label: "Feito" },
  error: { icon: CircleX, className: "bg-red-400/15 text-red-700", label: "Não deu certo" },
  info: { icon: Info, className: "bg-sky-400/20 text-sky-700", label: "Aviso" },
};

/** Onde os avisos aparecem. Uma vez só, nos providers. */
export function Toaster() {
  const list = useSyncExternalStore(
    subscribe,
    () => items,
    () => EMPTY,
  );
  const aboveBar = useSyncExternalStore(
    subscribeBars,
    () => bottomBars > 0,
    () => false,
  );
  return createPortal(
    <section
      aria-label="Avisos"
      aria-live="polite"
      className={cn(
        "pointer-events-none fixed right-4 z-[70] flex w-[min(22rem,calc(100vw-2rem))] flex-col items-stretch gap-2 md:right-6",
        aboveBar
          ? "bottom-[calc(5.5rem+env(safe-area-inset-bottom))] md:bottom-24"
          : "bottom-4 md:bottom-6",
      )}
    >
      <UpdateNotice />
      {list.map((t) => {
        const { icon: Icon, className, label } = STYLE[t.kind];
        return (
          <div
            key={t.id}
            role={t.kind === "error" ? "alert" : undefined}
            data-saindo={t.leaving || undefined}
            className="aviso-entrar vidro pointer-events-auto relative flex items-start gap-3 rounded-2xl p-3 pr-10 shadow-[0_24px_48px_-24px_rgb(0_0_0/0.35)]"
          >
            <span className={`grid size-8 shrink-0 place-items-center rounded-xl ${className}`}>
              <Icon className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 pt-1">
              <p className="text-sm leading-snug text-neutral-800">
                <span className="sr-only">{label}: </span>
                {t.text}
              </p>
              {t.action && (
                <button
                  type="button"
                  onClick={() => {
                    t.action?.onClick();
                    dismiss(t.id);
                  }}
                  className="mt-2 inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-full bg-neutral-900 px-4 text-xs md:h-8 md:px-3 font-medium text-white transition hover:bg-neutral-800"
                >
                  {/^desfazer/i.test(t.action.label) && <Undo2 className="size-3.5" aria-hidden />}
                  {t.action.label}
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Fechar aviso"
              className="absolute top-2 right-2 grid size-7 cursor-pointer place-items-center rounded-full text-neutral-500 transition hover:bg-neutral-900/[0.07] hover:text-neutral-900"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </div>
        );
      })}
    </section>,
    document.body,
  );
}

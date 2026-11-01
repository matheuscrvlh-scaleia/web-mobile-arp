import { CircleCheck, CircleX, Info, type LucideIcon, X } from "lucide-react";
import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { errorMessage } from "@/shared/api";

// Avisos rápidos no canto inferior direito: o retorno das ações ("Loja
// salva.", erros). Sucesso some sozinho; erro fica mais tempo. Um
// <Toaster /> só, nos providers; qualquer lugar chama toast.success().

export type ToastKind = "success" | "error" | "info";

interface ToastItem {
  id: number;
  kind: ToastKind;
  text: string;
  leaving?: boolean;
}

const DURATION_MS: Record<ToastKind, number> = { success: 4500, info: 6000, error: 9000 };
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

function show(kind: ToastKind, text: string) {
  const id = nextId++;
  // A mesma mensagem repetida troca a anterior em vez de empilhar.
  update((l) =>
    [...l.filter((t) => !(t.kind === kind && t.text === text)), { id, kind, text }].slice(-MAX),
  );
  const ms = Math.min(Math.max(DURATION_MS[kind], text.length * 60), 15_000);
  setTimeout(() => dismiss(id), ms);
}

export const toast = {
  success: (text: string) => show("success", text),
  info: (text: string) => show("info", text),
  error: (text: string) => show("error", text),
  /** Mensagem amigável de qualquer erro (ApiError traz a do servidor). */
  fromError: (e: unknown) => show("error", errorMessage(e)),
  dismiss,
};

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
  return createPortal(
    <section
      aria-label="Avisos"
      aria-live="polite"
      className="pointer-events-none fixed right-4 bottom-4 z-[70] flex w-[min(22rem,calc(100vw-2rem))] flex-col items-stretch gap-2 md:right-6 md:bottom-6"
    >
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
            <p className="min-w-0 pt-1 text-sm leading-snug text-neutral-800">
              <span className="sr-only">{label}: </span>
              {t.text}
            </p>
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

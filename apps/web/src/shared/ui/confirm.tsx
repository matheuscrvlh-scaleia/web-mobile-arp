import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";
import { ConfirmDialog } from "./Modal";

// Confirmação chamada de fora do JSX (ex.: ao sair com alterações não
// salvas), no lugar do window.confirm: `if (await confirmar({...}))`.
// Um <ConfirmHost /> só, nos providers.

export interface ConfirmOptions {
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  /** Botão neutro (padrão "Voltar"). Nunca "Cancelar" ao lado de "Cancelar evento". */
  cancelLabel?: string;
  danger?: boolean;
  /** Texto a digitar para liberar o botão: só em ação em massa (regra do painel). */
  confirmText?: string;
}

interface Pending extends ConfirmOptions {
  resolve: (ok: boolean) => void;
}

let pending: Pending | null = null;
const listeners = new Set<() => void>();

function set(next: Pending | null) {
  pending = next;
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function confirmar(options: ConfirmOptions): Promise<boolean> {
  // Uma pergunta por vez: a anterior conta como "Cancelar".
  pending?.resolve(false);
  return new Promise((resolve) => set({ ...options, resolve }));
}

function answer(ok: boolean) {
  pending?.resolve(ok);
  set(null);
}

export function ConfirmHost() {
  const current = useSyncExternalStore(
    subscribe,
    () => pending,
    () => null,
  );
  return (
    <ConfirmDialog
      open={current !== null}
      onClose={() => answer(false)}
      onConfirm={() => answer(true)}
      title={current?.title ?? ""}
      description={current?.description}
      confirmLabel={current?.confirmLabel ?? "Confirmar"}
      cancelLabel={current?.cancelLabel}
      danger={current?.danger}
      confirmText={current?.confirmText}
    />
  );
}

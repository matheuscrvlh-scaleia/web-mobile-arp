import { useCallback, useEffect, useRef, useState } from "react";
import { useBlocker } from "react-router";
import { confirmar } from "@/shared/ui/confirm";

/** Valor que só muda depois de `ms` sem alteração (busca enquanto digita). */
export function useDebouncedValue<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

/** Título da aba do navegador: "Lojas · ARP Gestor". */
export function useDocumentTitle(title: string | null | undefined) {
  useEffect(() => {
    if (!title) return;
    const previous = document.title;
    document.title = `${title} · ARP Gestor`;
    return () => {
      document.title = previous;
    };
  }, [title]);
}

/** Copia para a área de transferência e marca "copiado" por 2 s. */
export function useCopyToClipboard(): [boolean, (text: string) => Promise<boolean>] {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
      return true;
    } catch {
      return false;
    }
  }, []);
  return [copied, copy];
}

// Telas abertas com alterações não salvas (o "Atualizar" da versão nova
// pergunta antes de recarregar) e a liberação para recarregar sem o aviso
// do navegador depois que a pessoa já confirmou no modal.
let dirtyScreens = 0;
let unloadReleased = false;

/** Alguma tela aberta tem alterações não salvas? */
export function hasUnsavedChanges(): boolean {
  return dirtyScreens > 0;
}

/** Recarrega sem o aviso do navegador (a confirmação já foi feita no modal). */
export function reloadPage() {
  unloadReleased = true;
  window.location.reload();
}

/**
 * Segura a saída da tela com alterações não salvas: confirma num modal ao
 * trocar de rota e avisa o navegador ao fechar/recarregar a aba (esse aviso
 * é do próprio navegador, não dá para trocar). Depois de salvar e antes de
 * navegar de propósito, chame `allowLeave()`.
 */
export function useUnsavedChangesGuard(dirty: boolean): { allowLeave: () => void } {
  const released = useRef(false);
  const asking = useRef(false);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && !released.current && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (blocker.state !== "blocked" || asking.current) return;
    asking.current = true;
    void confirmar({
      title: "Sair sem salvar?",
      description: "Há alterações não salvas nesta tela. Se sair agora, elas se perdem.",
      confirmLabel: "Sair sem salvar",
      danger: true,
    }).then((ok) => {
      asking.current = false;
      if (ok) blocker.proceed();
      else blocker.reset();
    });
  }, [blocker]);

  useEffect(() => {
    if (!dirty) {
      released.current = false;
      return;
    }
    dirtyScreens++;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!released.current && !unloadReleased) e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      dirtyScreens--;
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [dirty]);

  const allowLeave = useCallback(() => {
    released.current = true;
  }, []);
  return { allowLeave };
}

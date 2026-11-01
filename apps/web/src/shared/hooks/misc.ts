import { useCallback, useEffect, useRef, useState } from "react";
import { useBlocker } from "react-router";

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

/**
 * Segura a saída da tela com alterações não salvas: confirma ao trocar de
 * rota e avisa o navegador ao fechar/recarregar a aba. Depois de salvar e
 * antes de navegar de propósito, chame `allowLeave()`.
 */
export function useUnsavedChangesGuard(dirty: boolean): { allowLeave: () => void } {
  const released = useRef(false);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && !released.current && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (blocker.state !== "blocked") return;
    if (window.confirm("Há alterações não salvas. Sair mesmo assim?")) blocker.proceed();
    else blocker.reset();
  }, [blocker]);

  useEffect(() => {
    if (!dirty) {
      released.current = false;
      return;
    }
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!released.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const allowLeave = useCallback(() => {
    released.current = true;
  }, []);
  return { allowLeave };
}

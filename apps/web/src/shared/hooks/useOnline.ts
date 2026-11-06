import { useSyncExternalStore } from "react";

function subscribe(listener: () => void) {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}

/** O navegador está com internet? (navigator.onLine + eventos online/offline) */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}

/** Chama `fn` uma vez quando a internet voltar (ex.: tentar baixar a tela de novo). */
export function onceOnline(fn: () => void): () => void {
  const handler = () => fn();
  window.addEventListener("online", handler, { once: true });
  return () => window.removeEventListener("online", handler);
}

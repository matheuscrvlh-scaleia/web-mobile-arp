import { useSyncExternalStore } from "react";

// Tema claro/escuro. A escolha fica no navegador (chave "tema", a mesma do
// copiloto) e o script do index.html a aplica antes da primeira pintura.

export type Theme = "light" | "dark";

const STORAGE_KEY = "tema";
const listeners = new Set<() => void>();

function read(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", theme === "dark" ? "#080808" : "#ececeb");
  for (const l of listeners) l();
}

export function setTheme(theme: Theme) {
  apply(theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme === "dark" ? "escuro" : "claro");
  } catch {
    // Sem armazenamento: vale até recarregar.
  }
}

/** Mudou em outra aba: acompanha. */
export function watchThemeAcrossTabs(): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) apply(e.newValue === "escuro" ? "dark" : "light");
  };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTheme(): [Theme, (theme: Theme) => void] {
  const theme = useSyncExternalStore(subscribe, read, () => "light" as const);
  return [theme, setTheme];
}

import { useCallback, useSyncExternalStore } from "react";

/** Abaixo do `md` do Tailwind (768px): celular. */
export const MOBILE_QUERY = "(max-width: 767.98px)";

/** true enquanto a media query casa (ex.: `useMediaQuery(MOBILE_QUERY)`). */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (listener: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", listener);
      return () => mql.removeEventListener("change", listener);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Atalho: tela de celular (< 768px). */
export const useIsMobile = () => useMediaQuery(MOBILE_QUERY);

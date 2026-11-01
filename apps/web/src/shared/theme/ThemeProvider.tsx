import { type ReactNode, useEffect } from "react";
import { watchThemeAcrossTabs } from "./theme";

/** Mantém o tema em sincronia entre abas. O estado em si mora no <html data-theme>. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => watchThemeAcrossTabs(), []);
  return children;
}

import type { ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Conteúdo que só existe na impressão (cartaz, etiqueta). Vai direto no
 * <body>; na impressão, todo o resto da página some (globals.css,
 * .area-impressao). Na tela fica escondido: mostre uma prévia à parte.
 */
export function PrintArea({ children }: { children: ReactNode }) {
  return createPortal(<div className="area-impressao">{children}</div>, document.body);
}

import { useSearchParams } from "react-router";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Tela de criação aberta por "Duplicar": `/cupons/nova?de=<id>` devolve o id
 * do item de origem (ou null). A tela busca o item, preenche o formulário
 * com "(cópia)" no nome, situação Rascunho e datas a revisar.
 */
export function useDuplicateSource(): string | null {
  const [params] = useSearchParams();
  const id = params.get("de");
  return id && UUID.test(id) ? id : null;
}

/** Link de "Duplicar": `duplicateHref(PATHS.couponNew, coupon.id)`. */
export const duplicateHref = (createPath: string, id: string) =>
  `${createPath}?de=${encodeURIComponent(id)}`;

/** Nome da cópia: "Black Friday" → "Black Friday (cópia)" (sem repetir o sufixo). */
export const copyName = (name: string) =>
  /\(cópia\)$/.test(name.trim()) ? name.trim() : `${name.trim()} (cópia)`;

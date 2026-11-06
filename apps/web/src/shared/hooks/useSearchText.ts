import { useEffect, useRef, useState } from "react";
import { useDebouncedValue } from "./misc";

/**
 * Texto da busca ligado à URL: digita à vontade e só grava (com espera)
 * quando para; se a URL mudar por fora (voltar do navegador), o campo
 * acompanha.
 */
export function useSearchText(
  urlValue: string | undefined,
  commit: (value: string) => void,
  ms = 350,
): [string, (value: string) => void, () => string] {
  const [text, setText] = useState(urlValue ?? "");
  const committed = useRef(urlValue ?? "");

  useEffect(() => {
    const v = urlValue ?? "";
    if (v !== committed.current) {
      committed.current = v;
      setText(v);
    }
  }, [urlValue]);

  const debounced = useDebouncedValue(text, ms);
  useEffect(() => {
    const v = debounced.trim();
    if (v !== committed.current) {
      committed.current = v;
      commit(v);
    }
  }, [debounced, commit]);

  // Grava agora o que está no campo (ex.: junto com a troca de um filtro) e
  // cancela a gravação que ainda esperava; devolve o texto limpo.
  const flush = () => {
    const v = text.trim();
    committed.current = v;
    return v;
  };

  return [text, setText, flush];
}

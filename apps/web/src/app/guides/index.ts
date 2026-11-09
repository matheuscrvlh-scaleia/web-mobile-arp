import { closing } from "./common";
import { GUIDES } from "./screens";
import type { Guide, Step } from "./types";

export { GUIDES } from "./screens";
export type { Guide, Step, Target } from "./types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Quanto a chave casa com o endereço (-1 = não casa). A chave é um caminho
 * em que `:id` vale um id de registro e pode trazer uma query obrigatória
 * (`/cupons?review=pending`). Casa por segmento, então a subtela usa o guia
 * da tela-mãe; ganha a mais específica (query > trecho fixo > `:id`).
 */
function matchScore(key: string, pathname: string, search: string): number {
  const [path = "", query] = key.split("?");
  const want = path.split("/");
  const got = pathname.replace(/\/+$/, "").split("/");
  if (got.length < want.length) return -1;
  let score = 0;
  for (const [i, w] of want.entries()) {
    const g = got[i] ?? "";
    if (w === ":id") {
      if (!UUID.test(g)) return -1;
      score += 1;
    } else if (w === g) score += w.length + 1;
    else return -1;
  }
  if (query) {
    const have = new URLSearchParams(search);
    for (const [k, v] of new URLSearchParams(query)) if (have.get(k) !== v) return -1;
    score += 1000;
  }
  return score;
}

/** O guia da tela: o da chave mais específica que casa com o endereço. */
export function guideFor(
  pathname: string,
  search = "",
): { key: string; guide: Guide; steps: Step[] } | null {
  let best: { key: string; score: number } | null = null;
  for (const key of Object.keys(GUIDES)) {
    const score = matchScore(key, pathname, search);
    if (score > 0 && (!best || score > best.score)) best = { key, score };
  }
  const guide = best ? GUIDES[best.key] : undefined;
  if (!best || !guide) return null;
  return { key: best.key, guide, steps: [...guide.steps, closing] };
}

/** Chave no navegador com a versão do guia que a pessoa já viu. */
export const seenKey = (key: string) => `guia-visto:${key}`;

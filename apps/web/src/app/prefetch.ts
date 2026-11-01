import { matchRoutes, type RouteObject } from "react-router";

// Pré-carga das telas: ao passar o mouse ou focar um link do menu, o chunk
// da tela já começa a baixar e o clique abre sem esperar. O router registra
// as rotas aqui (evita o ciclo router → layout → router).

let routes: RouteObject[] = [];
const started = new Set<string>();

export function setPrefetchRoutes(list: RouteObject[]) {
  routes = list;
}

/** Quem pediu para economizar dados não baixa nada antes da hora. */
function saveData(): boolean {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return connection?.saveData === true;
}

/** Baixa (uma vez) o código das telas que atendem `to` ("/lojas", "/mapa?andar=…"). */
export function prefetchRoute(to: string) {
  const path = to.split("?")[0] ?? to;
  if (started.has(path) || saveData()) return;
  started.add(path);
  for (const match of matchRoutes(routes, path) ?? []) {
    const { lazy } = match.route;
    if (typeof lazy === "function") {
      void Promise.resolve(lazy()).catch(() => started.delete(path));
    }
  }
}

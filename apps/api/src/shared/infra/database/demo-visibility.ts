import { type SqlFragment, sql } from "./sql";

/*
 * O app mostra os dados fictícios de demonstração (is_demo)? Definido uma vez
 * na subida pela DEMO_DATA_IN_APP (padrão: sim, para a demonstração do app).
 * atalho: estado de módulo em vez de injetar nas consultas; troca exige reiniciar.
 */
let demoInApp = true;

export function setDemoInApp(visible: boolean): void {
  demoInApp = visible;
}

/** Condição do app sobre a coluna is_demo (ex.: "c.is_demo"): esconde o fictício se desligado. */
export function appShowsDemo(column: string): SqlFragment {
  return demoInApp ? sql`true` : sql`not ${sql.raw(column)}`;
}

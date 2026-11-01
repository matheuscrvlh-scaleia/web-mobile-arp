import { realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { DatabaseLogger } from "./database";

/**
 * true quando o módulo foi chamado direto pela linha de comando (tsx/node).
 *
 * Comparar só import.meta.url com argv[1] não basta: depois do bundle (tsup),
 * o código deste módulo vive dentro de dist/main.js e os dois caminhos seriam
 * iguais, rodando o CLI na subida da API. Por isso também exigimos que o
 * arquivo termine com o sufixo esperado (ex.: "database/migrate").
 */
export function isCliEntry(importMetaUrl: string, suffix: string): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  const strip = (p: string) => {
    let resolved = path.resolve(p);
    try {
      resolved = realpathSync(resolved);
    } catch {
      // arquivo pode não existir com essa extensão; compara o caminho como veio
    }
    return resolved.replace(/\.[cm]?[jt]s$/, "").replaceAll("\\", "/");
  };
  const self = strip(fileURLToPath(importMetaUrl));
  return strip(entry) === self && self.endsWith(suffix);
}

/** Logger simples para os CLIs (o servidor usa o pino do Fastify). */
const print =
  (write: (...args: unknown[]) => void, level: string) => (obj: object, msg?: string) => {
    const line = `[${level}] ${msg ?? ""}`;
    if (Object.keys(obj).length > 0) write(line, obj);
    else write(line);
  };

export const consoleLogger: DatabaseLogger = {
  info: print(console.log, "info"),
  warn: print(console.warn, "warn"),
  error: print(console.error, "erro"),
};

/** Roda o main do CLI e define o exit code (sem process.exit: deixa o pool fechar). */
export function runCli(main: () => Promise<void>): void {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? (err.stack ?? err.message) : err);
    process.exitCode = 1;
  });
}

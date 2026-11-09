import { z } from "zod";

/*
 * Variáveis de ambiente do banco, do storage e do seed, validadas com Zod.
 * Usado pelos CLIs (db:migrate, db:seed); o config/env.ts da API
 * absorve estes shapes no schema completo.
 */

/** "true"/"false"/"1"/"0" → boolean. */
export const booleanString = z
  .enum(["true", "false", "1", "0"])
  .transform((v) => v === "true" || v === "1");

export const databaseEnvShape = {
  /** postgres://user:pass@host:port/db. No Supabase: pooler em modo session (porta 5432). */
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
  DB_SSL: z.enum(["auto", "require", "verify", "off"]).default("auto"),
  /** Certificado CA em PEM (só para DB_SSL=verify). */
  DB_SSL_CA: z.string().optional(),
  DB_STATEMENT_TIMEOUT_MS: z.coerce.number().int().min(0).default(30_000),
  /** Espera máxima por lock (0 = sem limite). Fila longa no FOR UPDATE vira erro em vez de pendurar. */
  DB_LOCK_TIMEOUT_MS: z.coerce.number().int().min(0).default(10_000),
  /** Sessão parada no meio de transação é derrubada pelo Postgres (0 = sem limite). */
  DB_IDLE_IN_TRANSACTION_TIMEOUT_MS: z.coerce.number().int().min(0).default(60_000),
  /** Tempo para abrir conexão OU esperar uma livre no pool cheio; estourou = 503. */
  DB_CONNECTION_TIMEOUT_MS: z.coerce.number().int().min(100).default(5_000),
  /** Conexão ociosa volta ao banco depois disso. */
  DB_IDLE_TIMEOUT_MS: z.coerce.number().int().min(1_000).default(30_000),
  /** Recicla conexões (failover, rebalanceamento do pooler). 0 = nunca. */
  DB_MAX_LIFETIME_SECONDS: z.coerce.number().int().min(0).default(1_800),
  /** Loga como lenta a consulta acima disso (0 = desliga). */
  DB_SLOW_QUERY_MS: z.coerce.number().int().min(0).default(500),
  /** Diretório das migrations; sem valor, procura supabase/migrations subindo pastas. */
  MIGRATIONS_DIR: z.string().optional(),
};

export const storageEnvShape = {
  /** Onde gravar imagens e arquivos (relativo ao diretório de trabalho). Em produção, o volume da VPS. */
  STORAGE_LOCAL_DIR: z.string().default("storage/uploads"),
  /** Prefixo das URLs (a API serve os arquivos aqui). */
  STORAGE_LOCAL_PUBLIC_PATH: z.string().startsWith("/").default("/uploads"),
  /**
   * Origem pública das URLs gravadas no banco (ex.: https://arp.controlapp.scaleia.ai).
   * Obrigatória em produção: o app mobile chama a API de outro host e precisa de URL absoluta.
   */
  STORAGE_PUBLIC_BASE_URL: z
    .url()
    .transform((u) => u.replace(/\/+$/, ""))
    .optional(),
};

export const seedEnvShape = {
  /** Senha dos usuários do painel criados pelo seed (admin e demais). */
  SEED_ADMIN_PASSWORD: z
    .string()
    .min(8, "SEED_ADMIN_PASSWORD precisa de 8+ caracteres")
    .regex(/[A-Za-z]/, "SEED_ADMIN_PASSWORD precisa de uma letra")
    .regex(/\d/, "SEED_ADMIN_PASSWORD precisa de um número"),
};

const databaseEnvSchema = z.object(databaseEnvShape);
const storageEnvSchema = z.object(storageEnvShape);
const seedEnvSchema = z.object(seedEnvShape);

export type DatabaseEnv = z.infer<typeof databaseEnvSchema>;
export type StorageEnv = z.infer<typeof storageEnvSchema>;
export type SeedEnv = z.infer<typeof seedEnvSchema>;

/** Falha cedo, listando todas as variáveis com problema de uma vez. */
export function parseEnv<T extends z.ZodType>(schema: T, env: NodeJS.ProcessEnv): z.infer<T> {
  // String vazia no .env conta como "não definida" (deixa o default agir).
  const cleaned = Object.fromEntries(Object.entries(env).filter(([, v]) => v !== ""));
  const result = schema.safeParse(cleaned);
  if (!result.success) {
    const lines = result.error.issues.map(
      (i) => `  - ${i.path.join(".") || "(env)"}: ${i.message}`,
    );
    throw new Error(`Variáveis de ambiente inválidas:\n${lines.join("\n")}`);
  }
  return result.data;
}

export const loadDatabaseEnv = (env = process.env) => parseEnv(databaseEnvSchema, env);
export const loadStorageEnv = (env = process.env) => parseEnv(storageEnvSchema, env);
export const loadSeedEnv = (env = process.env) => parseEnv(seedEnvSchema, env);

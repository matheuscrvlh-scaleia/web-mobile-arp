import { UPLOAD_MAX_BYTES } from "@arp/contracts";
import { z } from "zod";
import {
  booleanString,
  databaseEnvShape,
  parseEnv,
  seedEnvShape,
  storageEnvShape,
} from "../shared/infra/infra-env";

/*
 * Configuração da API validada na subida: variável faltando ou inválida
 * derruba o processo com a lista completa dos problemas.
 */

/** true/false, número de saltos (ex.: 1) ou lista de IPs/CIDRs confiáveis. */
const trustProxy = z
  .string()
  .default("false")
  .transform((v): boolean | number | string[] => {
    if (v === "true") return true;
    if (v === "false") return false;
    if (/^\d+$/.test(v)) return Number(v);
    return v
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  });

const csv = z.string().transform((v) =>
  v
    .split(",")
    .map((s) => s.trim().replace(/\/+$/, ""))
    .filter(Boolean),
);

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    HOST: z.string().default("0.0.0.0"),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
    TRUST_PROXY: trustProxy,
    /** Origens do painel/app aceitas pelo CORS (o web em produção usa a mesma origem via nginx). */
    CORS_ORIGINS: csv.default(["http://localhost:5173", "http://localhost:8082"]),
    /** Cookie do refresh com Secure. Padrão: ligado em produção. */
    COOKIE_SECURE: booleanString.optional(),

    JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET precisa de 32+ caracteres"),
    JWT_ISSUER: z.string().min(1).default("arp-api"),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(180).default(30),
    APP_REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(90),
    /**
     * Tolerância para reapresentar um refresh recém-trocado (resposta perdida
     * na rede, duas requisições renovando juntas) sem derrubar o login. 0 = sem.
     */
    REFRESH_REUSE_GRACE_SECONDS: z.coerce.number().int().min(0).max(300).default(60),

    /**
     * Login social do app: client ids aceitos como audiência do id_token,
     * separados por vírgula (um por plataforma). Vazio = provedor desligado (503).
     */
    GOOGLE_CLIENT_IDS: csv.default([]),
    APPLE_CLIENT_IDS: csv.default([]),
    /** Validade do código de 6 dígitos de "esqueci a senha" do app. */
    PASSWORD_RESET_CODE_TTL_MINUTES: z.coerce.number().int().min(5).max(60).default(15),
    /** Segredo do HMAC dos códigos de recuperação. Sem valor: derivado do JWT_ACCESS_SECRET. */
    PASSWORD_RESET_SECRET: z
      .string()
      .min(32, "PASSWORD_RESET_SECRET precisa de 32+ caracteres")
      .optional(),

    /** Por usuário/visitante autenticado (chave = id do token). */
    RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(300),
    /**
     * Por IP, só para quem não mandou token válido. Mais alto que o por usuário:
     * no wi-fi do complexo muitos visitantes saem pelo mesmo IP (NAT).
     */
    RATE_LIMIT_IP_MAX: z.coerce.number().int().min(1).default(1_200),
    RATE_LIMIT_WINDOW: z.string().default("1 minute"),
    /**
     * memory: cada réplica conta sozinha (padrão). postgres: as rotas sensíveis
     * (login, cadastro, pegar cupom, ler QR) contam numa tabela UNLOGGED
     * compartilhada; o limite global continua em memória.
     */
    RATE_LIMIT_STORE: z.enum(["memory", "postgres"]).default("memory"),
    /** Ações do visitante (pegar cupom, ler QR) por visitante. */
    ACTION_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(30),
    ACTION_RATE_LIMIT_WINDOW: z.string().default("1 minute"),
    LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(10),
    LOGIN_RATE_LIMIT_WINDOW: z.string().default("5 minutes"),

    UPLOAD_MAX_BYTES: z.coerce
      .number()
      .int()
      .min(1024)
      .max(UPLOAD_MAX_BYTES)
      .default(UPLOAD_MAX_BYTES),
    DASHBOARD_CACHE_TTL_SECONDS: z.coerce.number().int().min(0).max(3600).default(60),
    /** Leituras públicas do app (home, lojas, mapa, agenda, cupons, desafios). 0 = sem cache. */
    APP_CACHE_TTL_SECONDS: z.coerce.number().int().min(0).max(600).default(15),
    /** Teto de chaves do cache em memória por réplica. */
    CACHE_MAX_ENTRIES: z.coerce.number().int().min(100).default(5_000),
    /**
     * local: invalidação só na réplica que recebeu a escrita (as outras esperam o TTL).
     * postgres: LISTEN/NOTIFY no próprio banco avisa todas as réplicas (uma conexão a mais por réplica).
     */
    CACHE_INVALIDATION: z.enum(["local", "postgres"]).default("local"),
    /** Exibições/cliques de destaque acumulados em memória e gravados a cada N ms. */
    HIGHLIGHT_METRICS_FLUSH_MS: z.coerce.number().int().min(100).max(60_000).default(5_000),

    /** Tempo máximo de uma requisição (cabeçalhos + corpo + resposta). */
    HTTP_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1_000).default(60_000),
    /** Maior que o keepalive do proxy/balanceador (nginx 60 s, ALB 60 s). */
    HTTP_KEEP_ALIVE_TIMEOUT_MS: z.coerce.number().int().min(1_000).default(72_000),
    /** Corpo JSON máximo (upload multipart tem limite próprio). */
    HTTP_BODY_LIMIT_BYTES: z.coerce.number().int().min(1_024).default(1_048_576),
    /** gzip/br nas respostas JSON grandes (o app chama a API direto; atrás do nginx ele comprime). */
    HTTP_COMPRESSION: booleanString.default(true),
    /** No SIGTERM: readiness passa a 503 e espera isso antes de parar de aceitar conexões. */
    SHUTDOWN_DRAIN_MS: z.coerce.number().int().min(0).max(60_000).default(0),
    /** Tempo total para encerrar (drenar + fechar); depois disso o processo sai à força. */
    SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(120_000).default(20_000),
    /** GET /metrics (formato Prometheus). Desligado por padrão. */
    METRICS_ENABLED: booleanString.default(false),
    /** Se definido, /metrics exige Authorization: Bearer <token>. */
    METRICS_TOKEN: z.string().min(16).optional(),

    /**
     * E-mail transacional (código de nova senha). log: escreve no log (padrão
     * fora de produção). smtp: envia de verdade. Em produção sem valor, o
     * "esqueci a senha" responde 503.
     */
    MAIL_DRIVER: z.enum(["log", "smtp"]).optional(),
    /** Remetente, ex.: "ARP <nao-responda@arp.com.br>". Obrigatório com smtp. */
    MAIL_FROM: z.string().min(3).optional(),
    /** smtp(s)://usuario:senha@host:porta. Tem prioridade sobre SMTP_HOST/PORT/USER/PASSWORD. */
    SMTP_URL: z.url({ protocol: /^smtps?$/ }).optional(),
    SMTP_HOST: z.string().min(1).optional(),
    SMTP_PORT: z.coerce.number().int().min(1).max(65_535).default(587),
    /** TLS direto. Sem valor: ligado só na porta 465 (as outras usam STARTTLS). */
    SMTP_SECURE: booleanString.optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),

    RUN_MIGRATIONS_ON_START: booleanString.default(true),
    SEED_ON_START: booleanString.default(false),
    /** O app mostra os dados fictícios de demonstração (is_demo)? false: só o painel. */
    DEMO_DATA_IN_APP: booleanString.default(true),
    JOBS_ENABLED: booleanString.default(true),

    ...databaseEnvShape,
    ...storageEnvShape,
    ...seedEnvShape,
    // Só obrigatória quando SEED_ON_START=true (refine abaixo).
    SEED_ADMIN_PASSWORD: seedEnvShape.SEED_ADMIN_PASSWORD.optional(),
  })
  .superRefine((env, ctx) => {
    if (env.SEED_ON_START && !env.SEED_ADMIN_PASSWORD) {
      ctx.addIssue({
        code: "custom",
        path: ["SEED_ADMIN_PASSWORD"],
        message: "SEED_ON_START=true exige SEED_ADMIN_PASSWORD",
      });
    }
    if (env.STORAGE_DRIVER === "supabase" && !(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY)) {
      ctx.addIssue({
        code: "custom",
        path: ["STORAGE_DRIVER"],
        message: "STORAGE_DRIVER=supabase exige SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY",
      });
    }
    if (env.MAIL_DRIVER === "smtp" && !(env.MAIL_FROM && (env.SMTP_URL || env.SMTP_HOST))) {
      ctx.addIssue({
        code: "custom",
        path: ["MAIL_DRIVER"],
        message: "MAIL_DRIVER=smtp exige MAIL_FROM e SMTP_URL (ou SMTP_HOST)",
      });
    }
  })
  .transform((env) => ({
    ...env,
    COOKIE_SECURE: env.COOKIE_SECURE ?? env.NODE_ENV === "production",
  }));

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return parseEnv(envSchema, source);
}

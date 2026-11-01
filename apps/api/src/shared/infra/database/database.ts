import { AsyncLocalStorage } from "node:async_hooks";
import pg from "pg";
import { NoRowsError, TooManyRowsError } from "./errors";
import { type SqlFragment, sql } from "./sql";

/* Tipos ------------------------------------------------------------------ */

/** Subconjunto do logger do Fastify/pino usado aqui (o backend injeta o dele). */
export interface DatabaseLogger {
  info(obj: object, msg?: string): void;
  warn(obj: object, msg?: string): void;
  error(obj: object, msg?: string): void;
}

/**
 * auto: liga SSL quando o host não é local (padrão);
 * require: SSL sem validar o certificado (como o sslmode=require do libpq);
 * verify: SSL validando a cadeia (use DB_SSL_CA com o certificado do Supabase);
 * off: sem SSL.
 */
export type DbSslMode = "auto" | "require" | "verify" | "off";

export interface DatabaseOptions {
  connectionString: string;
  /** Conexões por instância da API. Supabase (pooler session) tem limite por projeto. */
  poolMax?: number;
  ssl?: DbSslMode;
  /** Certificado CA (PEM) para ssl=verify. */
  sslCa?: string;
  /** Mata consultas que passarem disso (0 = sem limite). Padrão 30 s. */
  statementTimeoutMs?: number;
  /** Desiste de esperar um lock de linha/tabela depois disso (0 = sem limite). Padrão 0. */
  lockTimeoutMs?: number;
  /** Derruba a sessão parada no meio de uma transação (0 = sem limite). Padrão 60 s. */
  idleInTransactionTimeoutMs?: number;
  /** Loga como lenta (warn) a consulta que passar disso. Padrão 500 ms; 0 desliga. */
  slowQueryMs?: number;
  applicationName?: string;
  idleTimeoutMs?: number;
  /** Abrir conexão nova OU esperar uma livre no pool (pool cheio). Padrão 5 s. */
  connectionTimeoutMs?: number;
  /** Recicla a conexão depois disso (failover/pooler). 0 = nunca. Padrão 30 min. */
  maxLifetimeSeconds?: number;
  logger?: DatabaseLogger;
  /** Campos extras nos logs do banco (ex.: requestId da requisição em andamento). */
  logContext?: () => Record<string, unknown> | undefined;
}

/** Estado do pool (métricas e readiness). */
export interface PoolStats {
  max: number;
  total: number;
  idle: number;
  /** Pedidos esperando conexão: > 0 de forma sustentada = pool pequeno ou banco lento. */
  waiting: number;
}

export interface QueryResult<T> {
  rows: T[];
  rowCount: number;
}

export type IsolationLevel = "read committed" | "repeatable read" | "serializable";

export interface TransactionOptions {
  /** Só vale para a transação de fora (savepoints herdam a da transação). */
  isolationLevel?: IsolationLevel;
  readOnly?: boolean;
}

/** Uma conexão emprestada do pool, compartilhada pelo contexto assíncrono. */
interface PinnedConnection {
  client: pg.PoolClient;
  /** Rollback falhou: a conexão está em estado incerto e é descartada ao devolver. */
  broken: boolean;
}

interface Context {
  conn: PinnedConnection;
  /** 0 = conexão fixada sem transação; 1 = transação; 2+ = savepoints. */
  depth: number;
}

/* Parsers de tipo -------------------------------------------------------- */

const OID = {
  INT8: 20,
  NUMERIC: 1700,
  DATE: 1082,
  TEXT_ARRAY: 1009,
  INT8_ARRAY: 1016,
  NUMERIC_ARRAY: 1231,
  DATE_ARRAY: 1182,
} as const;

/**
 * int8 (bigint, count(*), sum(int)) → number. Contagens e centavos cabem com
 * folga em 2^53; se um dia não couber, falha alto em vez de arredondar em
 * silêncio. Id de audit_logs (bigint) é lido com ::text e vai como string.
 */
export function parseInt8(value: string): number {
  const n = Number(value);
  if (!Number.isSafeInteger(n)) {
    throw new RangeError(`int8 ${value} não cabe em number com segurança; use ::text na consulta.`);
  }
  return n;
}

/**
 * numeric → number. Só aparece em agregados (avg, sum de bigint, divisões) e
 * coordenadas do mapa (numeric(6,2)); dinheiro é sempre centavos inteiros.
 */
export function parseNumeric(value: string): number {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new RangeError(`numeric ${value} não é um número finito.`);
  return n;
}

/**
 * Parsers por pool (não globais: não interferem em outras libs que usem pg).
 * - date fica string 'YYYY-MM-DD' (dia de calendário não tem fuso; virar Date
 *   em UTC mudaria o dia no Brasil);
 * - timestamptz continua Date (padrão do pg);
 * - time fica string 'HH:MM:SS' (o presenter corta para HH:mm).
 */
export function createTypeParsers(): pg.CustomTypesConfig {
  const types = new pg.TypeOverrides();
  // getTypeParser só tipa os OIDs do enum TypeId; 1009 (text[]) existe no pg-types.
  const parseTextArray = (
    pg.types.getTypeParser as (oid: number, format: "text") => (v: string) => (string | null)[]
  )(OID.TEXT_ARRAY, "text");
  const mapArray =
    <T>(fn: (v: string) => T) =>
    (value: string) =>
      parseTextArray(value).map((v) => (v === null ? null : fn(v)));

  types.setTypeParser(OID.INT8, "text", parseInt8);
  types.setTypeParser(OID.NUMERIC, "text", parseNumeric);
  types.setTypeParser(OID.DATE, "text", (v: string) => v);
  types.setTypeParser(OID.INT8_ARRAY, "text", mapArray(parseInt8));
  types.setTypeParser(OID.NUMERIC_ARRAY, "text", mapArray(parseNumeric));
  types.setTypeParser(
    OID.DATE_ARRAY,
    "text",
    mapArray((v) => v),
  );
  return types;
}

/* Conexão ---------------------------------------------------------------- */

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "host.docker.internal"]);

/** Host local ou nome de serviço do docker compose (sem ponto, ex.: "db"). */
export function isLocalHost(host: string): boolean {
  return LOCAL_HOSTS.has(host) || !host.includes(".") || host.endsWith(".local");
}

const SSLMODE_HINT: Record<string, DbSslMode> = {
  disable: "off",
  allow: "off",
  prefer: "require",
  require: "require",
  "verify-ca": "verify",
  "verify-full": "verify",
};

/**
 * Resolve o SSL e remove os parâmetros ssl* da URL: o pg deixa a URL
 * sobrescrever a opção `ssl` (e trata sslmode=require como verify-full),
 * o que tornaria DB_SSL inútil. Em modo auto, um sslmode na URL vale como dica.
 */
export function resolveConnection(
  connectionString: string,
  mode: DbSslMode = "auto",
  ca?: string,
): { connectionString: string; ssl: false | pg.ClientConfig["ssl"] } {
  const url = new URL(connectionString);
  const hint = url.searchParams.get("sslmode");
  for (const key of [...url.searchParams.keys()]) {
    if (key.startsWith("ssl") || key === "uselibpqcompat") url.searchParams.delete(key);
  }

  let effective = mode;
  if (effective === "auto") {
    const fromUrl = hint ? SSLMODE_HINT[hint] : undefined;
    effective = fromUrl ?? (isLocalHost(url.hostname) ? "off" : "require");
  }

  const ssl =
    effective === "off"
      ? false
      : effective === "verify"
        ? { rejectUnauthorized: true, ...(ca ? { ca } : {}) }
        : // Supabase usa CA própria; "require" cifra sem validar a cadeia, como o libpq.
          { rejectUnauthorized: false };

  return { connectionString: url.toString(), ssl };
}

/* Database --------------------------------------------------------------- */

/**
 * Acesso ao Postgres sem ORM, sobre um pg.Pool.
 *
 * Transações correm em AsyncLocalStorage: tudo que for chamado dentro de
 * `transaction(fn)` (repositórios, AuditLogger…) usa automaticamente o mesmo
 * client, sem receber parâmetro. É a implementação da porta UnitOfWork.
 *
 * Transação aninhada vira SAVEPOINT: se a interna falhar, só ela é desfeita e
 * o erro sobe; quem chamou decide se trata e segue ou deixa a de fora falhar.
 *
 * Não rode consultas em paralelo (Promise.all) dentro de uma transação: é uma
 * conexão só, elas seriam enfileiradas e um savepoint paralelo embaralharia.
 */
export class Database {
  readonly pool: pg.Pool;
  private readonly context = new AsyncLocalStorage<Context>();
  private readonly logger: DatabaseLogger | undefined;
  private readonly slowQueryMs: number;
  private readonly logContext: (() => Record<string, unknown> | undefined) | undefined;
  private readonly sessionSettings: [string, string][];
  private readonly poolMax: number;
  private closed = false;

  constructor(options: DatabaseOptions) {
    const { connectionString, ssl } = resolveConnection(
      options.connectionString,
      options.ssl,
      options.sslCa,
    );
    this.logger = options.logger;
    this.logContext = options.logContext;
    this.slowQueryMs = options.slowQueryMs ?? 500;
    this.poolMax = options.poolMax ?? 10;
    this.sessionSettings = sessionSettingsOf(options);
    this.pool = new pg.Pool({
      Client: sessionClient(this.sessionSettings),
      connectionString,
      ssl,
      max: this.poolMax,
      idleTimeoutMillis: options.idleTimeoutMs ?? 30_000,
      connectionTimeoutMillis: options.connectionTimeoutMs ?? 5_000,
      maxLifetimeSeconds: options.maxLifetimeSeconds ?? 1_800,
      application_name: options.applicationName ?? "arp-api",
      types: createTypeParsers(),
    });

    // Sem este listener, a queda de uma conexão ociosa derruba o processo.
    this.pool.on("error", (err) => {
      this.logger?.error({ err }, "Conexão ociosa do Postgres caiu");
    });
  }

  /** Conexões em uso, ociosas e pedidos na fila do pool. */
  stats(): PoolStats {
    return {
      max: this.poolMax,
      total: this.pool.totalCount,
      idle: this.pool.idleCount,
      waiting: this.pool.waitingCount,
    };
  }

  /**
   * Reaplica os timeouts da sessão na conexão fixada (depois de um SET
   * temporário, ex.: migrations com statement_timeout = 0).
   */
  async restoreSessionSettings(): Promise<void> {
    if (this.sessionSettings.length === 0) return;
    await this.query(sql.raw(sessionSettingsStatement(this.sessionSettings)));
  }

  /** Executa e devolve linhas + rowCount. */
  async query<T = Record<string, unknown>>(query: SqlFragment): Promise<QueryResult<T>> {
    const pinned = this.context.getStore()?.conn.client;
    if (pinned) return this.execute<T>(pinned, query);
    // Conexão primeiro, cronômetro depois: a espera na fila do pool cheio não é
    // "Consulta lenta" (sob carga, isso enchia o log apontando para consultas
    // de 1 ms que só esperaram a vez).
    const client = await this.pool.connect();
    let failed = false;
    try {
      return await this.execute<T>(client, query);
    } catch (err) {
      failed = true;
      throw err;
    } finally {
      // Como o pool.query: a conexão em que a consulta falhou é descartada.
      client.release(failed);
    }
  }

  private async execute<T>(client: pg.PoolClient, query: SqlFragment): Promise<QueryResult<T>> {
    const { text, values } = query.toQuery();
    const started = performance.now();
    const result = await client.query({ text, values });
    const elapsed = performance.now() - started;
    if (this.slowQueryMs > 0 && elapsed > this.slowQueryMs) {
      // Só o texto: os valores podem ter dados pessoais.
      this.logger?.warn(
        { ...this.logContext?.(), ms: Math.round(elapsed), query: text },
        "Consulta lenta",
      );
    }
    return { rows: result.rows as T[], rowCount: result.rowCount ?? 0 };
  }

  /** Todas as linhas. */
  async many<T = Record<string, unknown>>(query: SqlFragment): Promise<T[]> {
    return (await this.query<T>(query)).rows;
  }

  /** Exatamente uma linha: lança NoRowsError se vier 0 e TooManyRowsError se vier mais. */
  async one<T = Record<string, unknown>>(query: SqlFragment): Promise<T> {
    const { rows } = await this.query<T>(query);
    if (rows.length === 0) throw new NoRowsError(query.text);
    if (rows.length > 1) throw new TooManyRowsError(query.text, rows.length);
    return rows[0] as T;
  }

  /** Uma linha ou null; mais de uma é erro de consulta (TooManyRowsError). */
  async maybeOne<T = Record<string, unknown>>(query: SqlFragment): Promise<T | null> {
    const { rows } = await this.query<T>(query);
    if (rows.length > 1) throw new TooManyRowsError(query.text, rows.length);
    return rows[0] ?? null;
  }

  /** A consulta devolve alguma linha? (ex.: sql`select 1 from t where id = ${id}`) */
  async exists(query: SqlFragment): Promise<boolean> {
    const { found } = await this.one<{ found: boolean }>(sql`select exists (${query}) as found`);
    return found;
  }

  /** Executa fn numa transação (ou savepoint, se já houver uma no contexto). */
  async transaction<T>(fn: () => Promise<T>, options: TransactionOptions = {}): Promise<T> {
    const ctx = this.context.getStore();
    if (!ctx) return this.withConnection(() => this.transaction(fn, options));
    if (ctx.depth === 0) return this.runTransaction(ctx.conn, fn, options);
    return this.runSavepoint(ctx, fn);
  }

  /** true quando chamado dentro de transaction(). */
  get inTransaction(): boolean {
    return (this.context.getStore()?.depth ?? 0) > 0;
  }

  /**
   * Fixa uma conexão para tudo que rodar dentro de fn, sem abrir transação.
   * Necessário para estado de sessão (pg_advisory_lock, SET) — migrations e jobs.
   */
  async withConnection<T>(fn: () => Promise<T>): Promise<T> {
    if (this.context.getStore()) return fn();
    const client = await this.pool.connect();
    const conn: PinnedConnection = { client, broken: false };
    try {
      return await this.context.run({ conn, depth: 0 }, fn);
    } finally {
      client.release(
        conn.broken ? new Error("conexão descartada após falha no rollback") : undefined,
      );
    }
  }

  /** Verificação de saúde (health check). */
  async ping(): Promise<boolean> {
    try {
      await this.query(sql`select 1`);
      return true;
    } catch {
      return false;
    }
  }

  /** Fecha o pool (graceful shutdown). Idempotente. */
  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    await this.pool.end();
  }

  private async runTransaction<T>(
    conn: PinnedConnection,
    fn: () => Promise<T>,
    options: TransactionOptions,
  ): Promise<T> {
    await conn.client.query(beginStatement(options));
    let result: T;
    try {
      result = await this.context.run({ conn, depth: 1 }, fn);
    } catch (err) {
      await this.safely(conn, "rollback");
      throw err;
    }
    // Se o COMMIT falhar (ex.: serialização), o Postgres já desfez tudo.
    await conn.client.query("commit");
    return result;
  }

  private async runSavepoint<T>(ctx: Context, fn: () => Promise<T>): Promise<T> {
    const name = `sp_${ctx.depth}`;
    await ctx.conn.client.query(`savepoint ${name}`);
    let result: T;
    try {
      result = await this.context.run({ conn: ctx.conn, depth: ctx.depth + 1 }, fn);
    } catch (err) {
      await this.safely(ctx.conn, `rollback to savepoint ${name}`);
      throw err;
    }
    await ctx.conn.client.query(`release savepoint ${name}`);
    return result;
  }

  /** Rollback que não mascara o erro original; se falhar, descarta a conexão. */
  private async safely(conn: PinnedConnection, statement: string): Promise<void> {
    try {
      await conn.client.query(statement);
    } catch (err) {
      conn.broken = true;
      this.logger?.error({ err }, `Falha ao executar "${statement}"`);
    }
  }
}

/** Timeouts aplicados em toda conexão nova (só os ligados). */
function sessionSettingsOf(options: DatabaseOptions): [string, string][] {
  const settings: [string, number][] = [
    ["statement_timeout", options.statementTimeoutMs ?? 30_000],
    ["lock_timeout", options.lockTimeoutMs ?? 0],
    ["idle_in_transaction_session_timeout", options.idleInTransactionTimeoutMs ?? 60_000],
  ];
  return settings
    .filter(([, ms]) => Number.isInteger(ms) && ms > 0)
    .map(([name, ms]) => [name, `${ms}ms`]);
}

/**
 * Client do pool que aplica os timeouts logo depois de conectar, antes de a
 * conexão ser entregue a alguém. Por SET e não como parâmetro de startup: o
 * pooler do Supabase pode recusar parâmetros de startup que não conhece, e no
 * modo session o SET vale para a sessão inteira.
 */
function sessionClient(settings: [string, string][]): typeof pg.Client {
  if (settings.length === 0) return pg.Client;
  const statement = sessionSettingsStatement(settings);
  return class SessionClient extends pg.Client {
    // biome-ignore lint/suspicious/noExplicitAny: assinatura sobrecarregada do pg (callback ou promise)
    override connect(callback?: (err: any, client?: any) => void): any {
      const ready = super.connect().then(async () => {
        await this.query(statement);
        return this;
      });
      if (!callback) return ready;
      ready.then(
        (client) => callback(null, client),
        (err: unknown) => callback(err),
      );
      return undefined;
    }
  };
}

/** set_config(..., false) = vale para a sessão (sem parâmetros: roda antes de tudo). */
function sessionSettingsStatement(settings: [string, string][]): string {
  const calls = settings.map(([name, value]) => `set_config('${name}', '${value}', false)`);
  return `select ${calls.join(", ")}`;
}

function beginStatement({ isolationLevel, readOnly }: TransactionOptions): string {
  let statement = "begin";
  if (isolationLevel) statement += ` isolation level ${isolationLevel}`;
  if (readOnly) statement += " read only";
  return statement;
}

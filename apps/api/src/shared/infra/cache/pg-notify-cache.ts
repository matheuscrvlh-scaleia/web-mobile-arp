import { randomUUID } from "node:crypto";
import pg from "pg";
import type { Cache } from "../../application/ports/cache";
import type { Database, DatabaseLogger } from "../database/database";
import { resolveConnection } from "../database/database";
import { sql } from "../database/sql";

const CHANNEL = "arp_cache_invalidate";
const RECONNECT_MS = 2_000;

interface Message {
  from: string;
  prefix: string;
}

export interface PgNotifyCacheOptions {
  connectionString: string;
  ssl?: Parameters<typeof resolveConnection>[1];
  sslCa?: string;
  logger?: DatabaseLogger;
}

/**
 * Cache local com invalidação propagada a todas as réplicas por
 * LISTEN/NOTIFY do próprio Postgres (sem Redis). Cada réplica mantém UMA
 * conexão dedicada escutando o canal; invalidate() limpa a memória local na
 * hora e publica o prefixo para as outras.
 *
 * Exige sessão fixa: conexão direta ou pooler em modo session (no modo
 * transaction o LISTEN não funciona). Se a conexão cair, reconecta e, por
 * segurança, limpa os prefixos já vistos (pode ter perdido avisos).
 */
export class PgNotifyCache implements Cache {
  private readonly instanceId = randomUUID();
  private client: pg.Client | null = null;
  private closed = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private readonly seenPrefixes = new Set<string>();

  constructor(
    private readonly local: Cache,
    private readonly db: Database,
    private readonly options: PgNotifyCacheOptions,
  ) {}

  get<T>(key: string): T | undefined {
    return this.local.get<T>(key);
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    this.local.set(key, value, ttlMs);
  }

  getOrLoad<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
    return this.local.getOrLoad(key, ttlMs, load);
  }

  invalidate(prefix: string): void {
    this.local.invalidate(prefix);
    this.seenPrefixes.add(prefix);
    const payload = JSON.stringify({ from: this.instanceId, prefix } satisfies Message);
    // Chamado depois da resposta da escrita (já commitada); falha só atrasa as
    // outras réplicas até o TTL, não afeta a requisição.
    this.db.query(sql`select pg_notify(${CHANNEL}, ${payload})`).catch((err: unknown) => {
      this.options.logger?.warn({ err }, "Falha ao propagar invalidação de cache");
    });
  }

  /** Abre a conexão de escuta (não bloqueia a subida se o banco demorar). */
  async start(): Promise<void> {
    await this.connect();
  }

  async close(): Promise<void> {
    this.closed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    const client = this.client;
    this.client = null;
    await client?.end().catch(() => {});
  }

  private async connect(): Promise<void> {
    if (this.closed) return;
    const { connectionString, ssl } = resolveConnection(
      this.options.connectionString,
      this.options.ssl,
      this.options.sslCa,
    );
    const client = new pg.Client({
      connectionString,
      ssl,
      application_name: "arp-api-cache-listener",
      keepAlive: true,
    });
    client.on("notification", (msg) => this.onNotification(msg.payload));
    client.on("error", (err) => {
      this.options.logger?.warn({ err }, "Conexão de invalidação de cache caiu");
      this.scheduleReconnect(client);
    });
    client.on("end", () => this.scheduleReconnect(client));
    try {
      await client.connect();
      await client.query(`listen ${CHANNEL}`);
      const reconnected = this.seenPrefixes.size > 0;
      this.client = client;
      // Avisos enviados enquanto estávamos fora se perderam: limpa o que já foi cacheado.
      if (reconnected) for (const prefix of this.seenPrefixes) this.local.invalidate(prefix);
    } catch (err) {
      this.options.logger?.warn({ err }, "Não foi possível escutar invalidações de cache");
      this.scheduleReconnect(client);
    }
  }

  private scheduleReconnect(client: pg.Client): void {
    if (this.closed || this.reconnectTimer) return;
    if (this.client === client) this.client = null;
    client.end().catch(() => {});
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, RECONNECT_MS);
    this.reconnectTimer.unref();
  }

  private onNotification(payload: string | undefined): void {
    if (!payload) return;
    let message: Message;
    try {
      message = JSON.parse(payload) as Message;
    } catch {
      return;
    }
    if (message.from === this.instanceId || typeof message.prefix !== "string") return;
    this.seenPrefixes.add(message.prefix);
    this.local.invalidate(message.prefix);
  }
}

import type { RdStationConfig, RdStationStatus, UpdateRdStationBody } from "@arp/contracts";
import type { StaffActor } from "../../../shared/application/actor";
import { diff, hasChanges } from "../../../shared/application/audit-changes";
import type { AuditLogger } from "../../../shared/application/ports/audit-logger";
import type { Clock } from "../../../shared/application/ports/clock";
import type { UnitOfWork } from "../../../shared/application/ports/unit-of-work";
import { BusinessRuleError, ValidationError } from "../../../shared/domain/errors";
import type { Database, DatabaseLogger } from "../../../shared/infra/database/database";
import { sql } from "../../../shared/infra/database/sql";
import { isoOrNull } from "../../../shared/infra/presenters";
import { RdApiError, type RdAppCredentials, rdStationApi } from "../infra/rd-station-client";
import type { SecretBox } from "../infra/secret-box";

interface Row {
  client_id: string;
  client_secret_enc: string | null;
  refresh_token_enc: string | null;
  conversion: string | null;
  active: boolean;
  status: RdStationStatus;
  message: string | null;
  tested_at: Date | null;
  configured_at: Date;
  configured_by_name: string | null;
}

interface Probe {
  ok: boolean;
  message: string;
}

/** Contatos por rodada do job (a cada 10 min). */
const BATCH = 50;

/** Quem vai ao RD: aceitou novidades, conta ativa, não é demo, ainda não foi e o RD não recusou. */
const PENDING = sql`v.marketing_opt_in and v.status = 'active' and not v.is_demo
  and v.rd_sent_at is null and v.rd_error is null`;

const errorMessage = (e: unknown) =>
  e instanceof RdApiError ? e.message : "Falha ao falar com o RD Station";

export interface RdStationDeps {
  db: Database;
  uow: UnitOfWork;
  audit: AuditLogger;
  clock: Clock;
  box: SecretBox;
  logger: DatabaseLogger;
}

/**
 * RD Station Marketing por OAuth: configuração (Integrações no painel),
 * autorização, teste e o envio dos contatos com opt-in (job rd-station-leads).
 * O secret e o refresh token ficam cifrados e nunca voltam ao painel.
 */
export class RdStationService {
  constructor(private readonly deps: RdStationDeps) {}

  async get(): Promise<RdStationConfig> {
    const row = await this.load();
    const stats = await this.deps.db.one<{ pending: number; last_sent_at: Date | null }>(sql`
      select count(*) filter (where ${PENDING})::int as pending, max(v.rd_sent_at) as last_sent_at
      from visitors.visitors v
    `);
    return {
      clientId: row?.client_id ?? null,
      hasSecret: Boolean(row?.client_secret_enc),
      conversion: row?.conversion ?? null,
      active: row?.active ?? false,
      status: row?.status ?? "disconnected",
      message: row?.message ?? null,
      testedAt: isoOrNull(row?.tested_at),
      configuredAt: isoOrNull(row?.configured_at),
      configuredBy: row?.configured_by_name ?? null,
      pending: stats.pending,
      lastSentAt: isoOrNull(stats.last_sent_at),
    };
  }

  /** Salva e, se já conectado (e sem skipTest), testa antes com os dados novos. */
  async update(input: UpdateRdStationBody, actor: StaffActor): Promise<RdStationConfig> {
    const { db, uow, audit, box, clock } = this.deps;
    const before = await this.load();
    const secret =
      input.clientSecret || (before?.client_secret_enc ? box.open(before.client_secret_enc) : null);
    if (!secret) throw ValidationError.field("clientSecret", "Informe o Client secret");
    const secretEnc = input.clientSecret ? box.seal(input.clientSecret) : before?.client_secret_enc;

    // Outro app (Client ID diferente): a autorização do anterior não vale para ele.
    const refreshEnc = before?.client_id === input.clientId ? before.refresh_token_enc : null;
    let status: RdStationStatus = refreshEnc ? (before?.status ?? "connected") : "disconnected";
    let message = refreshEnc ? (before?.message ?? null) : null;
    let testedAt = refreshEnc ? (before?.tested_at ?? null) : null;

    if (refreshEnc && !input.skipTest) {
      const r = await this.probe({ clientId: input.clientId, clientSecret: secret }, refreshEnc);
      if (!r.ok && !input.saveIfTestFails) {
        throw new BusinessRuleError(`O RD recusou: ${r.message}. Nada foi salvo.`);
      }
      status = r.ok ? "connected" : "error";
      message = r.message;
      testedAt = clock.now();
    }

    const changes = diff(
      {
        clientId: before?.client_id ?? null,
        conversion: before?.conversion ?? null,
        active: before?.active ?? null,
      },
      { clientId: input.clientId, conversion: input.conversion, active: input.active },
    );
    // O secret nunca vai ao histórico: só que foi trocado.
    if (input.clientSecret) changes.clientSecret = { from: null, to: "trocado" };

    await uow.run(async () => {
      // refresh_token_enc fica fora do update quando o app é o mesmo: o teste
      // acima pode ter gravado um refresh novo (o RD troca às vezes).
      await db.query(sql`
        insert into platform.rd_station
          (id, client_id, client_secret_enc, refresh_token_enc, conversion, active, status,
           message, tested_at, configured_at, configured_by)
        values (1, ${input.clientId}, ${secretEnc}, ${refreshEnc}, ${input.conversion},
                ${input.active}, ${status}, ${message}, ${testedAt}, now(), ${actor.id})
        on conflict (id) do update set
          client_id = excluded.client_id,
          client_secret_enc = excluded.client_secret_enc,
          refresh_token_enc = case when platform.rd_station.client_id = excluded.client_id
                              then platform.rd_station.refresh_token_enc else null end,
          conversion = excluded.conversion,
          active = excluded.active,
          status = excluded.status,
          message = excluded.message,
          tested_at = excluded.tested_at,
          configured_at = excluded.configured_at,
          configured_by = excluded.configured_by
      `);
      if (hasChanges(changes)) {
        await audit.log({
          actor,
          action: before ? "integration.update" : "integration.create",
          entityType: "integration",
          entityId: "rd_station",
          changes,
        });
      }
    });
    return this.get();
  }

  /** Volta da autorização: troca o code pelo refresh token, guarda e testa. */
  async connect(code: string, actor: StaffActor): Promise<RdStationConfig> {
    const { db, uow, audit, box } = this.deps;
    const row = await this.load();
    const app = row && this.app(row);
    if (!app) throw new BusinessRuleError("Salve o Client ID e o secret antes de conectar");

    let refresh: string;
    try {
      refresh = await rdStationApi.exchangeCode(app, code);
    } catch (e) {
      throw new BusinessRuleError(
        `O RD não aceitou a autorização: ${errorMessage(e)}. Clique em Conectar de novo.`,
      );
    }
    const refreshEnc = box.seal(refresh);
    await uow.run(async () => {
      await db.query(sql`
        update platform.rd_station
        set refresh_token_enc = ${refreshEnc}, configured_at = now(), configured_by = ${actor.id}
      `);
      await audit.log({
        actor,
        action: "integration.connect",
        entityType: "integration",
        entityId: "rd_station",
        changes: null,
      });
    });
    await this.saveProbe(await this.probe(app, refreshEnc));
    return this.get();
  }

  async test(): Promise<RdStationConfig> {
    const row = await this.load();
    const app = row && this.app(row);
    if (!app || !row?.refresh_token_enc) {
      throw new BusinessRuleError("Conecte com o RD Station antes de testar");
    }
    await this.saveProbe(await this.probe(app, row.refresh_token_enc));
    return this.get();
  }

  async remove(actor: StaffActor): Promise<void> {
    const { db, uow, audit } = this.deps;
    await uow.run(async () => {
      const removed = await db.maybeOne(sql`delete from platform.rd_station returning id`);
      if (!removed) return;
      await audit.log({
        actor,
        action: "integration.remove",
        entityType: "integration",
        entityId: "rd_station",
        changes: null,
      });
    });
  }

  /** Uma rodada do job: até BATCH contatos. Devolve quantos foram. */
  async sendPending(): Promise<number> {
    const { db, logger } = this.deps;
    const row = await this.load();
    if (!row?.active || !row.refresh_token_enc || !row.conversion) return 0;
    const conversion = row.conversion;
    const app = this.app(row);
    if (!app) {
      await this.markError("O secret salvo não abre mais. Salve o Client secret de novo.");
      return 0;
    }

    let token: string;
    try {
      token = await this.accessToken(app, row.refresh_token_enc);
    } catch (e) {
      await this.markError(`Sem acesso ao RD: ${errorMessage(e)}`);
      return 0;
    }

    const leads = await db.many<{ id: string; name: string; email: string }>(sql`
      select v.id, v.name, v.email from visitors.visitors v
      where ${PENDING}
      order by v.created_at
      limit ${BATCH}
    `);
    let sent = 0;
    for (const lead of leads) {
      try {
        await rdStationApi.sendConversion(token, {
          conversion,
          name: lead.name,
          email: lead.email,
        });
      } catch (e) {
        const status = e instanceof RdApiError ? e.status : null;
        if (status === 400 || status === 422) {
          // O RD não aceita este contato (ex.: e-mail inválido): sai da fila e os outros seguem.
          await db.query(
            sql`update visitors.visitors set rd_error = ${errorMessage(e)} where id = ${lead.id}`,
          );
          continue;
        }
        if (status === 401 || status === 403) {
          await this.markError(`O RD recusou o acesso: ${errorMessage(e)}`);
        } else {
          logger.warn({ status, err: errorMessage(e) }, "RD Station fora; tenta de novo depois");
        }
        break;
      }
      await db.query(sql`update visitors.visitors set rd_sent_at = now() where id = ${lead.id}`);
      sent += 1;
    }
    if (sent > 0 && row.status === "error") {
      await db.query(sql`update platform.rd_station set status = 'connected', message = null`);
    }
    return sent;
  }

  private load(): Promise<Row | null> {
    return this.deps.db.maybeOne<Row>(sql`
      select r.client_id, r.client_secret_enc, r.refresh_token_enc, r.conversion, r.active,
             r.status, r.message, r.tested_at, r.configured_at, u.name as configured_by_name
      from platform.rd_station r
      left join identity.users u on u.id = r.configured_by
    `);
  }

  private app(row: Pick<Row, "client_id" | "client_secret_enc">): RdAppCredentials | null {
    const secret = row.client_secret_enc ? this.deps.box.open(row.client_secret_enc) : null;
    return secret ? { clientId: row.client_id, clientSecret: secret } : null;
  }

  /** Access token pelo refresh salvo; grava o refresh novo quando o RD troca. */
  private async accessToken(app: RdAppCredentials, refreshEnc: string): Promise<string> {
    const { db, box } = this.deps;
    const refresh = box.open(refreshEnc);
    if (!refresh) {
      throw new RdApiError(null, "o acesso salvo não abre mais (a chave mudou); conecte de novo");
    }
    const t = await rdStationApi.refresh(app, refresh);
    if (t.refreshToken && t.refreshToken !== refresh) {
      await db.query(
        sql`update platform.rd_station set refresh_token_enc = ${box.seal(t.refreshToken)}`,
      );
    }
    return t.accessToken;
  }

  private async probe(app: RdAppCredentials, refreshEnc: string): Promise<Probe> {
    try {
      const name = await rdStationApi.accountName(await this.accessToken(app, refreshEnc));
      return { ok: true, message: `Conectado à conta “${name}”` };
    } catch (e) {
      return { ok: false, message: errorMessage(e) };
    }
  }

  private async saveProbe(r: Probe): Promise<void> {
    await this.deps.db.query(sql`
      update platform.rd_station
      set status = ${r.ok ? "connected" : "error"}, message = ${r.message}, tested_at = now()
    `);
  }

  private async markError(message: string): Promise<void> {
    this.deps.logger.warn({ message }, "RD Station: envio parado");
    await this.deps.db.query(
      sql`update platform.rd_station set status = 'error', message = ${message}`,
    );
  }
}

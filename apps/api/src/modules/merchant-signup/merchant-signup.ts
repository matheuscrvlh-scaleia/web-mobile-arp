import type {
  ListMerchantSignupsQuery,
  MerchantInvitation,
  MerchantInvite,
  MerchantSignup,
  MerchantSignupBody,
  MerchantSignupStatus,
} from "@arp/contracts";
import type { StaffActor } from "../../shared/application/actor";
import type { AuditLogger } from "../../shared/application/ports/audit-logger";
import type { Clock } from "../../shared/application/ports/clock";
import type { Mailer } from "../../shared/application/ports/mailer";
import type { PasswordHasher } from "../../shared/application/ports/password-hasher";
import type { OpaqueTokenGenerator } from "../../shared/application/ports/token-service";
import type { UnitOfWork } from "../../shared/application/ports/unit-of-work";
import { BusinessRuleError, ConflictError, NotFoundError } from "../../shared/domain/errors";
import type { Database, DatabaseLogger } from "../../shared/infra/database/database";
import { translateConstraintErrors } from "../../shared/infra/database/errors";
import { sql } from "../../shared/infra/database/sql";
import { iso, isoOrNull } from "../../shared/infra/presenters";

/*
 * Cadastro de lojista pelo link (Fase 2). Módulo pequeno num arquivo só
 * (atalho: separar em domain/application/infra se crescer).
 */

const INVITE_DAYS = 7;
const DAY_MS = 86_400_000;
export const INVITE_INVALID = "Este link de cadastro não vale mais. Peça um novo para a ARP.";
export const SIGNUP_NOT_FOUND = "Cadastro não encontrado";
const MERCHANT_ROLE = "Lojista";

export interface MerchantSignupDeps {
  db: Database;
  uow: UnitOfWork;
  clock: Clock;
  audit: AuditLogger;
  hasher: PasswordHasher;
  opaqueTokens: OpaqueTokenGenerator;
  mailer: Mailer | null;
  logger: DatabaseLogger;
}

export class MerchantSignupService {
  constructor(private readonly deps: MerchantSignupDeps) {}

  /** A ARP gera o link da loja (o token só sai aqui; no banco fica o hash). */
  async invite(storeId: string, actor: StaffActor): Promise<MerchantInvite> {
    const { db, uow, clock, audit, opaqueTokens } = this.deps;
    const { token, hash } = opaqueTokens.generate();
    const expiresAt = new Date(clock.now().getTime() + INVITE_DAYS * DAY_MS);
    return uow.run(async () => {
      const store = await db.maybeOne<{ id: string; name: string }>(
        sql`select id, name from directory.stores where id = ${storeId}`,
      );
      if (!store) throw new NotFoundError("Loja não encontrada");
      const { id } = await db.one<{ id: string }>(sql`
        insert into identity.merchant_invites (token_hash, store_id, created_by, expires_at)
        values (${hash}, ${storeId}, ${actor.id}, ${expiresAt})
        returning id
      `);
      await audit.log({
        actor,
        action: "merchant_invite.create",
        entityType: "merchant_invite",
        entityId: id,
        changes: { storeId },
      });
      return { token, store, expiresAt: iso(expiresAt) };
    });
  }

  /** Página pública do link: de que loja é. */
  async invitation(token: string): Promise<MerchantInvitation> {
    const row = await this.findInvite(token);
    return { store: { id: row.store_id, name: row.store_name }, expiresAt: iso(row.expires_at) };
  }

  /** Lojista se cadastra pelo link: fica pendente até a ARP aprovar. */
  async signup(token: string, body: MerchantSignupBody): Promise<void> {
    const { db, uow, hasher } = this.deps;
    const invite = await this.findInvite(token);
    const exists = await db.exists(
      sql`select 1 from identity.users where lower(email) = ${body.email.toLowerCase()}`,
    );
    if (exists) throw new ConflictError("Já existe um acesso com esse e-mail. Entre com ele.");
    const passwordHash = await hasher.hash(body.password);
    await uow.run(() =>
      translateConstraintErrors(
        () =>
          db.query(sql`
            insert into identity.merchant_signups
              (invite_id, store_id, name, email, phone, password_hash)
            values (${invite.id}, ${invite.store_id}, ${body.name}, ${body.email}, ${body.phone},
                    ${passwordHash})
          `),
        {
          merchant_signups_pending_email_key: () =>
            new ConflictError("Já existe um cadastro com esse e-mail aguardando a ARP."),
        },
      ),
    );
  }

  async list(query: ListMerchantSignupsQuery): Promise<MerchantSignup[]> {
    const rows = await this.deps.db.many<SignupRow>(sql`
      ${SIGNUP_SELECT}
      ${query.status ? sql`where ms.status = ${query.status}` : sql.empty}
      order by (ms.status = 'pending') desc, ms.created_at desc
      limit 200
    `);
    return rows.map(toSignup);
  }

  /** Aprova: cria o usuário Lojista da loja com a senha do cadastro e avisa por e-mail. */
  async approve(id: string, actor: StaffActor): Promise<MerchantSignup> {
    const { db, uow, clock, audit } = this.deps;
    const signup = await uow.run(async () => {
      const s = await this.pending(id);
      const role = await db.maybeOne<{ id: string }>(
        sql`select id from identity.roles where name = ${MERCHANT_ROLE}`,
      );
      if (!role) throw new BusinessRuleError(`Crie o cargo "${MERCHANT_ROLE}" antes de aprovar.`);
      const user = await translateConstraintErrors(
        () =>
          db.one<{ id: string }>(sql`
            insert into identity.users
              (name, email, password_hash, role_id, store_id, status, must_change_password)
            values (${s.name}, ${s.email}, ${s.password_hash}, ${role.id}, ${s.store_id}, 'active',
                    false)
            returning id
          `),
        { users_email_key: () => new ConflictError("Já existe um usuário com esse e-mail") },
      );
      await this.decide(id, "approved", actor.id, clock.now(), user.id);
      await audit.log({
        actor,
        action: "merchant_signup.approve",
        entityType: "merchant_signup",
        entityId: id,
        changes: { userId: user.id, storeId: s.store_id },
      });
      return s;
    });
    await this.notify(signup.email, signup.name, signup.store_name);
    return this.get(id);
  }

  async reject(id: string, actor: StaffActor): Promise<MerchantSignup> {
    const { uow, clock, audit } = this.deps;
    await uow.run(async () => {
      await this.pending(id);
      await this.decide(id, "rejected", actor.id, clock.now(), null);
      await audit.log({
        actor,
        action: "merchant_signup.reject",
        entityType: "merchant_signup",
        entityId: id,
        changes: {},
      });
    });
    return this.get(id);
  }

  private async findInvite(token: string) {
    const row = await this.deps.db.maybeOne<{
      id: string;
      store_id: string;
      store_name: string;
      expires_at: Date;
    }>(sql`
      select i.id, i.store_id, s.name as store_name, i.expires_at
      from identity.merchant_invites i
      join directory.stores s on s.id = i.store_id
      where i.token_hash = ${this.deps.opaqueTokens.hash(token)}
        and i.expires_at > ${this.deps.clock.now()}
    `);
    if (!row) throw new NotFoundError(INVITE_INVALID);
    return row;
  }

  private async pending(id: string) {
    const row = await this.deps.db.maybeOne<SignupRow & { password_hash: string }>(sql`
      select ms.*, s.name as store_name
      from identity.merchant_signups ms
      join directory.stores s on s.id = ms.store_id
      where ms.id = ${id}
      for update of ms
    `);
    if (!row) throw new NotFoundError(SIGNUP_NOT_FOUND);
    if (row.status !== "pending") throw new ConflictError("Este cadastro já foi decidido");
    return row;
  }

  private async decide(
    id: string,
    status: MerchantSignupStatus,
    by: string,
    at: Date,
    userId: string | null,
  ): Promise<void> {
    await this.deps.db.query(sql`
      update identity.merchant_signups
      set status = ${status}, decided_by = ${by}, decided_at = ${at}, user_id = ${userId}
      where id = ${id}
    `);
  }

  private async get(id: string): Promise<MerchantSignup> {
    const row = await this.deps.db.one<SignupRow>(sql`${SIGNUP_SELECT} where ms.id = ${id}`);
    return toSignup(row);
  }

  /** Aviso de aprovação por e-mail. Sem envio configurado, só registra (a ARP avisa no WhatsApp). */
  private async notify(email: string, name: string, storeName: string): Promise<void> {
    const { mailer, logger } = this.deps;
    if (!mailer) {
      logger.warn({ email }, "Lojista aprovado sem envio de e-mail configurado");
      return;
    }
    try {
      await mailer.send({
        to: email,
        subject: "Seu acesso de lojista da ARP foi aprovado",
        text: `Olá, ${name}!\n\nA ARP aprovou o seu cadastro da loja ${storeName}. Já dá para entrar na Área do lojista do app ARP com o seu e-mail e a senha que você escolheu.\n\nEquipe ARP`,
      });
    } catch (err) {
      logger.error({ err, email }, "Falha ao enviar o aviso de lojista aprovado");
    }
  }
}

interface SignupRow {
  id: string;
  store_id: string;
  store_name: string;
  name: string;
  email: string;
  phone: string | null;
  status: MerchantSignupStatus;
  created_at: Date;
  decided_at: Date | null;
}

const SIGNUP_SELECT = sql`
  select ms.id, ms.store_id, s.name as store_name, ms.name, ms.email, ms.phone, ms.status,
         ms.created_at, ms.decided_at
  from identity.merchant_signups ms
  join directory.stores s on s.id = ms.store_id
`;

const toSignup = (r: SignupRow): MerchantSignup => ({
  id: r.id,
  store: { id: r.store_id, name: r.store_name },
  name: r.name,
  email: r.email,
  phone: r.phone,
  status: r.status,
  createdAt: iso(r.created_at),
  decidedAt: isoOrNull(r.decided_at),
});

import type { RequestOrigin } from "../../../shared/application/actor";
import { snapshot } from "../../../shared/application/audit-changes";
import type { AuditLogger } from "../../../shared/application/ports/audit-logger";
import type { Clock } from "../../../shared/application/ports/clock";
import type { PasswordHasher } from "../../../shared/application/ports/password-hasher";
import type { TokenService } from "../../../shared/application/ports/token-service";
import type { UnitOfWork } from "../../../shared/application/ports/unit-of-work";
import { ForbiddenError, UnauthenticatedError } from "../../../shared/domain/errors";
import type { MerchantAccountRepository } from "../domain/repositories";
import { type MerchantStoreReader, merchantScopeOf } from "./merchant-scope";
import {
  MERCHANT_SESSION_AUDIENCE,
  type MerchantSessionResult,
  type MerchantSessions,
  merchantSession,
} from "./merchant-session";

export interface MerchantLoginDeps {
  accounts: MerchantAccountRepository;
  stores: MerchantStoreReader;
  hasher: PasswordHasher;
  sessions: MerchantSessions;
  tokens: TokenService;
  audit: AuditLogger;
  clock: Clock;
  uow: UnitOfWork;
  /** Hash da senha de um cadastro pelo link ainda pendente (Fase 2). */
  pendingSignupHash?: (email: string) => Promise<string | null>;
}

export const INVALID_CREDENTIALS_MESSAGE = "E-mail ou senha incorretos";

/**
 * Login do lojista no app, com as regras do login do painel: e-mail
 * desconhecido, senha errada ou usuário desativado dão a mesma resposta e
 * custam o mesmo tempo. Senha certa sem `coupons.redeem` ou sem loja → 403,
 * sem abrir sessão. Senha provisória não bloqueia (igual ao painel): o
 * `mustChangePassword` vai no usuário e o app leva à troca
 * (POST /api/v1/auth/change-password com o mesmo Bearer).
 */
export class MerchantLoginUseCase {
  private dummyHash: Promise<string> | null = null;

  constructor(private readonly deps: MerchantLoginDeps) {}

  /** Cadastro pelo link ainda não aprovado: com a senha certa, avisa em vez de "senha errada". */
  private async assertNotPending(email: string, password: string): Promise<void> {
    const hash = await this.deps.pendingSignupHash?.(email);
    if (hash && (await this.deps.hasher.verify(hash, password))) {
      throw new ForbiddenError("Seu cadastro está aguardando a aprovação da ARP.");
    }
  }

  async execute(input: {
    email: string;
    password: string;
    origin: RequestOrigin;
  }): Promise<MerchantSessionResult> {
    const { accounts, stores, hasher, sessions, tokens, audit, clock, uow } = this.deps;
    const account = await accounts.findByEmail(input.email);
    const hash = account?.passwordHash ?? (await this.getDummyHash());
    const valid = await hasher.verify(hash, input.password);
    if (!account) await this.assertNotPending(input.email, input.password);
    if (!account || !valid || account.status !== "active") {
      throw new UnauthenticatedError(INVALID_CREDENTIALS_MESSAGE, "INVALID_CREDENTIALS");
    }
    const scope = await merchantScopeOf(account, stores);

    const refresh = await uow.run(async () => {
      await accounts.recordLogin(account.id, clock.now());
      const issued = await sessions.start(MERCHANT_SESSION_AUDIENCE, account.id, input.origin);
      await audit.log({
        actor: { type: "staff", id: account.id, name: account.name, origin: input.origin },
        action: "auth.login",
        entityType: "user",
        entityId: account.id,
        changes: snapshot({ channel: "merchant_app" }),
      });
      return issued;
    });
    return merchantSession(tokens, account, scope, refresh);
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= this.deps.hasher.hash("senha-que-ninguem-usa-0");
    return this.dummyHash;
  }
}

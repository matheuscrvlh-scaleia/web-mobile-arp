import type { RequestOrigin } from "../../../shared/application/actor";
import type { AuditLogger } from "../../../shared/application/ports/audit-logger";
import type { Clock } from "../../../shared/application/ports/clock";
import type { PasswordHasher } from "../../../shared/application/ports/password-hasher";
import type { TokenService } from "../../../shared/application/ports/token-service";
import type { UnitOfWork } from "../../../shared/application/ports/unit-of-work";
import { UnauthenticatedError } from "../../../shared/domain/errors";
import type {
  PendingSignupReader,
  StaffProfileReader,
  UserRepository,
} from "../domain/repositories";
import type { SessionService } from "./session-service";
import { signStaffToken } from "./staff-token-issuer";

export interface LoginInput {
  email: string;
  password: string;
  origin: RequestOrigin;
}

export interface StaffSessionResult {
  userId: string;
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  refreshExpiresAt: Date;
}

export interface LoginDeps {
  users: UserRepository;
  profiles: StaffProfileReader;
  hasher: PasswordHasher;
  sessions: SessionService;
  tokens: TokenService;
  audit: AuditLogger;
  clock: Clock;
  uow: UnitOfWork;
  /** Opcional: explica a espera para quem se cadastrou e ainda não foi aprovado. */
  pendingSignups?: PendingSignupReader;
}

export const INVALID_CREDENTIALS_MESSAGE = "E-mail ou senha incorretos";
export const ACCOUNT_DISABLED_MESSAGE =
  "Seu acesso foi desativado. Fale com o administrador do painel.";
export const SIGNUP_PENDING_MESSAGE =
  "Seu cadastro está aguardando aprovação da ARP. Você recebe um e-mail quando for liberado.";

/**
 * Login do painel. E-mail desconhecido e senha errada dão a mesma resposta
 * e custam o mesmo tempo — não revela quem tem conta. Usuário desativado
 * só fica sabendo disso depois de acertar a senha (quem não sabe a senha
 * não descobre nada).
 */
export class LoginUseCase {
  private dummyHash: Promise<string> | null = null;

  constructor(private readonly deps: LoginDeps) {}

  async execute(input: LoginInput): Promise<StaffSessionResult> {
    const { users, profiles, hasher, sessions, tokens, audit, clock, uow } = this.deps;
    const user = await users.findByEmail(input.email);
    // Sem usuário, mas com cadastro de lojista pendente: confere a senha do cadastro.
    // Mesmo custo (um verify só) e só diz algo a quem acertou a senha.
    const pendingHash = user
      ? null
      : await this.deps.pendingSignups?.pendingPasswordHash(input.email);
    const hash = user?.passwordHash ?? pendingHash ?? (await this.getDummyHash());
    const valid = await hasher.verify(hash, input.password);
    if (!user && pendingHash && valid)
      throw new UnauthenticatedError(SIGNUP_PENDING_MESSAGE, "SIGNUP_PENDING");
    if (!user || !valid) {
      throw new UnauthenticatedError(INVALID_CREDENTIALS_MESSAGE, "INVALID_CREDENTIALS");
    }
    if (!user.isActive)
      throw new UnauthenticatedError(ACCOUNT_DISABLED_MESSAGE, "ACCOUNT_DISABLED");

    const refresh = await uow.run(async () => {
      await users.recordLogin(user.id, clock.now());
      const issued = await sessions.start("admin", user.id, input.origin);
      await audit.log({
        actor: { type: "staff", id: user.id, name: user.name, origin: input.origin },
        action: "auth.login",
        entityType: "user",
        entityId: user.id,
      });
      return issued;
    });

    const profile = await profiles.findProfile(user.id);
    if (!profile)
      throw new UnauthenticatedError(INVALID_CREDENTIALS_MESSAGE, "INVALID_CREDENTIALS");
    const access = await signStaffToken(tokens, profile, refresh.familyId);
    return {
      userId: user.id,
      accessToken: access.token,
      expiresIn: access.expiresIn,
      refreshToken: refresh.refreshToken,
      refreshExpiresAt: refresh.expiresAt,
    };
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= this.deps.hasher.hash("senha-que-ninguem-usa-0");
    return this.dummyHash;
  }
}

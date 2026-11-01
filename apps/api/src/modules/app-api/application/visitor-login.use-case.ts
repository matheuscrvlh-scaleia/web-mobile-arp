import type { RequestOrigin } from "../../../shared/application/actor";
import type { AuditLogger } from "../../../shared/application/ports/audit-logger";
import type { Clock } from "../../../shared/application/ports/clock";
import type { PasswordHasher } from "../../../shared/application/ports/password-hasher";
import type { TokenService } from "../../../shared/application/ports/token-service";
import type { UnitOfWork } from "../../../shared/application/ports/unit-of-work";
import { ForbiddenError, UnauthenticatedError } from "../../../shared/domain/errors";
import type { VisitorAccountRepository } from "../domain/repositories";
import {
  type AppSessions,
  BLOCKED_MESSAGE,
  INVALID_CREDENTIALS_MESSAGE,
  type VisitorSessionResult,
  visitorSession,
} from "./visitor-session";

export interface VisitorLoginDeps {
  visitors: VisitorAccountRepository;
  hasher: PasswordHasher;
  sessions: AppSessions;
  tokens: TokenService;
  audit: AuditLogger;
  clock: Clock;
  uow: UnitOfWork;
}

/**
 * Login do app. E-mail desconhecido, senha errada ou conta sem senha (login
 * social) dão a mesma resposta e custam o mesmo tempo. Só quem acerta a
 * senha descobre que a conta está bloqueada.
 */
export class VisitorLoginUseCase {
  private dummyHash: Promise<string> | null = null;

  constructor(private readonly deps: VisitorLoginDeps) {}

  async execute(input: {
    email: string;
    password: string;
    origin: RequestOrigin;
  }): Promise<VisitorSessionResult> {
    const { visitors, hasher, sessions, tokens, audit, clock, uow } = this.deps;
    const visitor = await visitors.findByEmail(input.email);
    const hash = visitor?.passwordHash ?? (await this.getDummyHash());
    const valid = await hasher.verify(hash, input.password);
    if (!visitor?.passwordHash || !valid) {
      throw new UnauthenticatedError(INVALID_CREDENTIALS_MESSAGE, "INVALID_CREDENTIALS");
    }
    if (!visitor.isActive) throw new ForbiddenError(BLOCKED_MESSAGE);

    const refresh = await uow.run(async () => {
      await visitors.touchLastSeen(visitor.id, clock.now());
      const issued = await sessions.start("app", visitor.id, input.origin);
      await audit.log({
        actor: { type: "visitor", id: visitor.id, name: visitor.name, origin: input.origin },
        action: "visitor.login",
        entityType: "visitor",
        entityId: visitor.id,
      });
      return issued;
    });
    return visitorSession(tokens, visitor, refresh);
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= this.deps.hasher.hash("senha-que-ninguem-usa-0");
    return this.dummyHash;
  }
}

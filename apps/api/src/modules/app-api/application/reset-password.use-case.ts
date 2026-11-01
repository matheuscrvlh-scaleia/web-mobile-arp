import type { RequestOrigin } from "../../../shared/application/actor";
import type { AuditLogger } from "../../../shared/application/ports/audit-logger";
import type { Clock } from "../../../shared/application/ports/clock";
import type { PasswordHasher } from "../../../shared/application/ports/password-hasher";
import type { TokenService } from "../../../shared/application/ports/token-service";
import type { UnitOfWork } from "../../../shared/application/ports/unit-of-work";
import { ValidationError } from "../../../shared/domain/errors";
import type {
  PasswordResetRepository,
  VisitorAccountRepository,
  VisitorCredentialsRepository,
} from "../domain/repositories";
import {
  INVALID_RESET_CODE_MESSAGE,
  RESET_MAX_ATTEMPTS,
  type ResetCodeHasher,
} from "./password-reset";
import { type AppSessions, type VisitorSessionResult, visitorSession } from "./visitor-session";

export interface ResetPasswordInput {
  email: string;
  code: string;
  password: string;
  origin: RequestOrigin;
}

export interface ResetPasswordDeps {
  visitors: Pick<VisitorAccountRepository, "findByEmail" | "touchLastSeen">;
  credentials: Pick<VisitorCredentialsRepository, "updatePassword">;
  resets: PasswordResetRepository;
  codes: ResetCodeHasher;
  hasher: PasswordHasher;
  sessions: AppSessions;
  tokens: TokenService;
  audit: AuditLogger;
  clock: Clock;
  uow: UnitOfWork;
}

const invalidCode = () => ValidationError.field("code", INVALID_RESET_CODE_MESSAGE);

/**
 * Nova senha com o código do e-mail. Código errado conta tentativa (na 5ª
 * ele deixa de valer); certo troca a senha, gasta o código, derruba todos
 * os logins do app e já devolve uma sessão nova.
 */
export class ResetPasswordUseCase {
  constructor(private readonly deps: ResetPasswordDeps) {}

  async execute(input: ResetPasswordInput): Promise<VisitorSessionResult> {
    const { visitors, credentials, resets, codes, hasher, sessions, tokens, audit, clock, uow } =
      this.deps;
    // Antes de tudo: argon2 é lento e assim e-mail com ou sem conta custa o mesmo.
    const passwordHash = await hasher.hash(input.password);
    const visitor = await visitors.findByEmail(input.email);
    if (!visitor?.passwordHash || !visitor.isActive) throw invalidCode();

    const refresh = await uow.run(async () => {
      const reset = await resets.findPendingForUpdate(visitor.id);
      const now = clock.now();
      if (!reset || reset.expiresAt <= now || reset.attempts >= RESET_MAX_ATTEMPTS) return null;
      if (!codes.matches(visitor.id, input.code, reset.codeHash)) {
        // Gravado mesmo com o erro: o erro sai fora da transação.
        await resets.incrementAttempts(reset.id);
        return null;
      }
      await credentials.updatePassword(visitor.id, passwordHash);
      await resets.markUsed(reset.id, now);
      // Antes do start: a sessão nova não pode cair junto.
      await sessions.endAllFor(visitor.id, "app");
      await visitors.touchLastSeen(visitor.id, now);
      const issued = await sessions.start("app", visitor.id, input.origin);
      await audit.log({
        actor: { type: "visitor", id: visitor.id, name: visitor.name, origin: input.origin },
        action: "visitor.password_reset",
        entityType: "visitor",
        entityId: visitor.id,
      });
      return issued;
    });
    if (!refresh) throw invalidCode();
    return visitorSession(tokens, visitor, refresh);
  }
}

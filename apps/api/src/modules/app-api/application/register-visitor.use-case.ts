import type { RequestOrigin } from "../../../shared/application/actor";
import type { AuditLogger } from "../../../shared/application/ports/audit-logger";
import type { Clock } from "../../../shared/application/ports/clock";
import type { PasswordHasher } from "../../../shared/application/ports/password-hasher";
import type { TokenService } from "../../../shared/application/ports/token-service";
import type { UnitOfWork } from "../../../shared/application/ports/unit-of-work";
import type { VisitorAccountRepository } from "../domain/repositories";
import { type AppSessions, type VisitorSessionResult, visitorSession } from "./visitor-session";

export interface RegisterVisitorInput {
  name: string;
  email: string;
  phone?: string | null;
  password: string;
  marketingOptIn: boolean;
  origin: RequestOrigin;
}

export interface RegisterVisitorDeps {
  visitors: VisitorAccountRepository;
  hasher: PasswordHasher;
  sessions: AppSessions;
  tokens: TokenService;
  audit: AuditLogger;
  clock: Clock;
  uow: UnitOfWork;
}

/** Cadastro com e-mail e senha; já sai logado. Os termos foram aceitos (o contrato exige). */
export class RegisterVisitorUseCase {
  constructor(private readonly deps: RegisterVisitorDeps) {}

  async execute(input: RegisterVisitorInput): Promise<VisitorSessionResult> {
    const { visitors, hasher, sessions, tokens, audit, clock, uow } = this.deps;
    const passwordHash = await hasher.hash(input.password);

    const { visitor, refresh } = await uow.run(async () => {
      const visitor = await visitors.create({
        name: input.name,
        email: input.email,
        phone: input.phone ?? null,
        passwordHash,
        marketingOptIn: input.marketingOptIn,
        termsAcceptedAt: clock.now(),
      });
      const refresh = await sessions.start("app", visitor.id, input.origin);
      await audit.log({
        actor: { type: "visitor", id: visitor.id, name: visitor.name, origin: input.origin },
        action: "visitor.register",
        entityType: "visitor",
        entityId: visitor.id,
        changes: { name: visitor.name, marketingOptIn: input.marketingOptIn },
      });
      return { visitor, refresh };
    });
    return visitorSession(tokens, visitor, refresh);
  }
}

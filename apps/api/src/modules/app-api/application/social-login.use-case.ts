import type { RequestOrigin } from "../../../shared/application/actor";
import type { AuditLogger } from "../../../shared/application/ports/audit-logger";
import type { Clock } from "../../../shared/application/ports/clock";
import type { TokenService } from "../../../shared/application/ports/token-service";
import type { UnitOfWork } from "../../../shared/application/ports/unit-of-work";
import { ForbiddenError } from "../../../shared/domain/errors";
import { EmailUsesOtherLoginError, TermsRequiredError } from "../domain/errors";
import type {
  VisitorAccountRepository,
  VisitorCredentialsRepository,
} from "../domain/repositories";
import type { SocialProvider, VisitorAccount } from "../domain/visitor-account";
import type { SocialIdentity, SocialIdentityVerifier } from "./social-identity";
import {
  type AppSessions,
  BLOCKED_MESSAGE,
  type VisitorSessionResult,
  visitorSession,
} from "./visitor-session";

export interface SocialLoginInput {
  provider: SocialProvider;
  idToken: string;
  nonce?: string | undefined;
  name?: string | undefined;
  acceptTerms?: boolean | undefined;
  marketingOptIn?: boolean | undefined;
  origin: RequestOrigin;
}

export interface SocialLoginDeps {
  verifier: SocialIdentityVerifier;
  visitors: Pick<VisitorAccountRepository, "findByEmail" | "touchLastSeen">;
  credentials: VisitorCredentialsRepository;
  sessions: AppSessions;
  tokens: TokenService;
  audit: AuditLogger;
  clock: Clock;
  uow: UnitOfWork;
}

const NAME_MAX = 120;

/**
 * Login com Google/Apple pelo id_token. Conta achada pelo (provedor, sub)
 * entra; e-mail de conta de outro método é 409 (sem vínculo automático);
 * conta nova exige o aceite dos termos e já sai logada.
 */
export class SocialLoginUseCase {
  constructor(private readonly deps: SocialLoginDeps) {}

  async execute(input: SocialLoginInput): Promise<VisitorSessionResult> {
    const { verifier, visitors, credentials } = this.deps;
    const identity = await verifier.verify(input.provider, input.idToken, input.nonce);

    const existing = await credentials.findByProviderSubject(input.provider, identity.subject);
    if (existing) return this.login(existing, input);

    const sameEmail = await visitors.findByEmail(identity.email);
    if (sameEmail) throw new EmailUsesOtherLoginError(sameEmail.authProvider);
    if (input.acceptTerms !== true) throw new TermsRequiredError();
    return this.register(identity, input);
  }

  private async login(
    visitor: VisitorAccount,
    input: SocialLoginInput,
  ): Promise<VisitorSessionResult> {
    const { visitors, sessions, tokens, audit, clock, uow } = this.deps;
    if (!visitor.isActive) throw new ForbiddenError(BLOCKED_MESSAGE);
    const refresh = await uow.run(async () => {
      await visitors.touchLastSeen(visitor.id, clock.now());
      const issued = await sessions.start("app", visitor.id, input.origin);
      await audit.log({
        actor: { type: "visitor", id: visitor.id, name: visitor.name, origin: input.origin },
        action: "visitor.login",
        entityType: "visitor",
        entityId: visitor.id,
        changes: { provider: input.provider },
      });
      return issued;
    });
    return visitorSession(tokens, visitor, refresh);
  }

  private async register(
    identity: SocialIdentity,
    input: SocialLoginInput,
  ): Promise<VisitorSessionResult> {
    const { credentials, sessions, tokens, audit, clock, uow } = this.deps;
    const marketingOptIn = input.marketingOptIn ?? false;
    const { visitor, refresh } = await uow.run(async () => {
      const visitor = await credentials.createSocial({
        name: displayName(input.name, identity),
        email: identity.email,
        provider: input.provider,
        providerSubject: identity.subject,
        marketingOptIn,
        termsAcceptedAt: clock.now(),
      });
      const refresh = await sessions.start("app", visitor.id, input.origin);
      await audit.log({
        actor: { type: "visitor", id: visitor.id, name: visitor.name, origin: input.origin },
        action: "visitor.register",
        entityType: "visitor",
        entityId: visitor.id,
        changes: { name: visitor.name, provider: input.provider, marketingOptIn },
      });
      return { visitor, refresh };
    });
    return visitorSession(tokens, visitor, refresh);
  }
}

/** Nome do corpo (a Apple só manda no 1º login, pelo app), depois o do token, depois o e-mail. */
function displayName(fromBody: string | undefined, identity: SocialIdentity): string {
  const name =
    fromBody?.trim() ||
    identity.name?.trim() ||
    identity.email.split("@")[0]?.trim() ||
    "Visitante";
  return name.slice(0, NAME_MAX);
}

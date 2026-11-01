import type { RequestOrigin } from "../../../shared/application/actor";
import type { Clock } from "../../../shared/application/ports/clock";
import type { TokenService } from "../../../shared/application/ports/token-service";
import { UnauthenticatedError } from "../../../shared/domain/errors";
import type { VisitorAccountRepository } from "../domain/repositories";
import { type AppSessions, type VisitorSessionResult, visitorSession } from "./visitor-session";

export interface RefreshVisitorSessionDeps {
  visitors: VisitorAccountRepository;
  sessions: AppSessions;
  tokens: TokenService;
  clock: Clock;
}

/** Renova a sessão do app (refresh rotativo); visitante bloqueado perde todas as sessões. */
export class RefreshVisitorSessionUseCase {
  constructor(private readonly deps: RefreshVisitorSessionDeps) {}

  async execute(input: {
    refreshToken: string;
    origin: RequestOrigin;
  }): Promise<VisitorSessionResult> {
    const { visitors, sessions, tokens, clock } = this.deps;
    const rotated = await sessions.rotate("app", input.refreshToken, input.origin);
    const visitor = await visitors.findById(rotated.subjectId);
    if (!visitor?.isActive) {
      await sessions.endAllFor(rotated.subjectId, "app");
      throw new UnauthenticatedError("Sua sessão terminou. Entre de novo.");
    }
    await visitors.touchLastSeen(visitor.id, clock.now());
    return visitorSession(tokens, visitor, {
      refreshToken: rotated.refreshToken,
      expiresAt: rotated.expiresAt,
      familyId: rotated.familyId,
    });
  }
}

import type { RequestOrigin } from "../../../shared/application/actor";
import type { TokenService } from "../../../shared/application/ports/token-service";
import { UnauthenticatedError } from "../../../shared/domain/errors";
import type { StaffProfileReader } from "../domain/repositories";
import type { StaffSessionResult } from "./login.use-case";
import type { SessionService } from "./session-service";
import { signStaffToken } from "./staff-token-issuer";

export interface RefreshSessionDeps {
  sessions: SessionService;
  profiles: StaffProfileReader;
  tokens: TokenService;
}

/** Renova a sessão do painel; o novo access token traz cargo e loja atualizados. */
export class RefreshSessionUseCase {
  constructor(private readonly deps: RefreshSessionDeps) {}

  async execute(input: {
    refreshToken: string;
    origin: RequestOrigin;
  }): Promise<StaffSessionResult> {
    const rotated = await this.deps.sessions.rotate("admin", input.refreshToken, input.origin);
    const profile = await this.deps.profiles.findProfile(rotated.subjectId);
    if (!profile || profile.status !== "active") {
      await this.deps.sessions.endAllFor(rotated.subjectId, "admin");
      throw new UnauthenticatedError("Sua sessão terminou. Entre de novo.");
    }
    const access = await signStaffToken(this.deps.tokens, profile, rotated.familyId);
    return {
      userId: profile.id,
      accessToken: access.token,
      expiresIn: access.expiresIn,
      refreshToken: rotated.refreshToken,
      refreshExpiresAt: rotated.expiresAt,
    };
  }
}

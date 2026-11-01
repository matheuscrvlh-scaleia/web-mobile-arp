import type { TokenService } from "../../../shared/application/ports/token-service";
import type { SessionService } from "../../identity/application/session-service";

/** O que os casos de uso do app usam do SessionService (facilita testes). */
export type AppSessions = Pick<SessionService, "start" | "rotate" | "end" | "endAllFor">;

export interface VisitorSessionResult {
  visitorId: string;
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  refreshExpiresAt: Date;
}

export const INVALID_CREDENTIALS_MESSAGE = "E-mail ou senha incorretos";
export const BLOCKED_MESSAGE =
  "Sua conta está bloqueada. Fale com o atendimento da ARP para saber mais.";

/** Monta a sessão do app: access token (aud "app") + refresh já emitido. */
export async function visitorSession(
  tokens: TokenService,
  visitor: { id: string; name: string },
  refresh: { refreshToken: string; expiresAt: Date; familyId: string },
): Promise<VisitorSessionResult> {
  const access = await tokens.signAccessToken({
    audience: "app",
    subject: visitor.id,
    sessionId: refresh.familyId,
    name: visitor.name,
  });
  return {
    visitorId: visitor.id,
    accessToken: access.token,
    expiresIn: access.expiresIn,
    refreshToken: refresh.refreshToken,
    refreshExpiresAt: refresh.expiresAt,
  };
}

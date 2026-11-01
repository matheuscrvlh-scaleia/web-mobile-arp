import type { EngagementRepository } from "../domain/repositories";
import type { AppSessions } from "./visitor-session";

/**
 * Revoga o login do refresh token informado (token desconhecido: nada a
 * fazer) e desvincula o push do aparelho, se informado. Com o login achado,
 * só apaga o token se ainda for da conta que saiu; sem ele (refresh já
 * vencido), o aparelho prova a posse do token e ele é apagado.
 */
export class VisitorLogoutUseCase {
  constructor(
    private readonly deps: {
      sessions: AppSessions;
      engagement: Pick<EngagementRepository, "removePushToken">;
    },
  ) {}

  async execute(input: { refreshToken: string; pushToken?: string }): Promise<void> {
    const ended = await this.deps.sessions.end(input.refreshToken);
    if (input.pushToken) {
      await this.deps.engagement.removePushToken(input.pushToken, ended?.subjectId);
    }
  }
}

import type { SessionService } from "./session-service";

/** Revoga o login do refresh token apresentado. Sem token ou token desconhecido: nada a fazer. */
export class LogoutUseCase {
  constructor(private readonly deps: { sessions: SessionService }) {}

  async execute(input: { refreshToken: string | undefined }): Promise<void> {
    if (!input.refreshToken) return;
    await this.deps.sessions.end(input.refreshToken);
  }
}

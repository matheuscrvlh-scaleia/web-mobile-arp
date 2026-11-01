import type { MerchantSessions } from "./merchant-session";

/** Revoga o login do refresh token informado. Token desconhecido: nada a fazer. */
export class MerchantLogoutUseCase {
  constructor(private readonly deps: { sessions: MerchantSessions }) {}

  async execute(input: { refreshToken: string }): Promise<void> {
    await this.deps.sessions.end(input.refreshToken);
  }
}

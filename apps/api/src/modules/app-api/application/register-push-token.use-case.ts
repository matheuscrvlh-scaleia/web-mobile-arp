import type { VisitorActor } from "../../../shared/application/actor";
import type { Clock } from "../../../shared/application/ports/clock";
import type { EngagementRepository, PushPlatform } from "../domain/repositories";

/** Registra o token de push do aparelho para o visitante logado. */
export class RegisterPushTokenUseCase {
  constructor(private readonly deps: { engagement: EngagementRepository; clock: Clock }) {}

  async execute(
    input: { token: string; platform: PushPlatform },
    actor: VisitorActor,
  ): Promise<void> {
    await this.deps.engagement.upsertPushToken(
      actor.id,
      input.token,
      input.platform,
      this.deps.clock.now(),
    );
  }
}

/** Desvincula o token do aparelho do visitante logado (idempotente). */
export class RemovePushTokenUseCase {
  constructor(private readonly deps: { engagement: EngagementRepository }) {}

  async execute(input: { token: string }, actor: VisitorActor): Promise<void> {
    await this.deps.engagement.removePushToken(input.token, actor.id);
  }
}

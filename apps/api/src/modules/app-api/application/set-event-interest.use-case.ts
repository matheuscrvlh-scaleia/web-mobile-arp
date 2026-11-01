import type { VisitorActor } from "../../../shared/application/actor";
import { NotFoundError } from "../../../shared/domain/errors";
import type { EngagementRepository } from "../domain/repositories";

/** "Tenho interesse" no evento (lembrete no dia). Idempotente; só eventos publicados. */
export class SetEventInterestUseCase {
  constructor(private readonly deps: { engagement: EngagementRepository }) {}

  async execute(input: { eventId: string; on: boolean }, actor: VisitorActor): Promise<void> {
    const { engagement } = this.deps;
    if (input.on && !(await engagement.isEventPublished(input.eventId))) {
      throw new NotFoundError("Evento não encontrado");
    }
    await engagement.setInterest(actor.id, input.eventId, input.on);
  }
}

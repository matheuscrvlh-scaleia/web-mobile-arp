import type { StaffActor } from "../../../shared/application/actor";
import { snapshot } from "../../../shared/application/audit-changes";
import { NotFoundError } from "../../../shared/domain/errors";
import { EVENT_NOT_FOUND, type EventUseCaseDeps } from "./agenda-deps";

/** Exclui evento sem interessados (qualquer situação). Com interessados: arquivar. */
export class DeleteEventUseCase {
  constructor(private readonly deps: EventUseCaseDeps) {}

  async execute(input: { id: string }, actor: StaffActor): Promise<void> {
    const imageUrl = await this.deps.uow.run(async () => {
      const event = await this.deps.events.findById(input.id);
      if (!event) throw new NotFoundError(EVENT_NOT_FOUND);
      event.assertDeletable(await this.deps.events.countInterests(event.id));
      await this.deps.events.delete(event.id);
      await this.deps.audit.log({
        actor,
        action: "event.delete",
        entityType: "event",
        entityId: event.id,
        changes: snapshot(event.toState()),
      });
      return event.toState().imageUrl;
    });
    await this.deps.images.discard([imageUrl]);
  }
}

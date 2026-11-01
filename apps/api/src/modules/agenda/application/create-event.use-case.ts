import type { StaffActor } from "../../../shared/application/actor";
import { snapshot } from "../../../shared/application/audit-changes";
import { AgendaEvent, type NewAgendaEvent } from "../domain/agenda-event";
import { assertReferences, type EventUseCaseDeps } from "./agenda-deps";

export class CreateEventUseCase {
  constructor(private readonly deps: EventUseCaseDeps) {}

  async execute(input: NewAgendaEvent, actor: StaffActor): Promise<string> {
    const data = AgendaEvent.validateNew(input);
    return this.deps.uow.run(async () => {
      await assertReferences(this.deps.references, data);
      const event = await this.deps.events.create(data);
      await this.deps.audit.log({
        actor,
        action: "event.create",
        entityType: "event",
        entityId: event.id,
        changes: snapshot(event.toState()),
      });
      return event.id;
    });
  }
}

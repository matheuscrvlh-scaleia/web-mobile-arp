import type { StaffActor } from "../../../shared/application/actor";
import { diff, hasChanges } from "../../../shared/application/audit-changes";
import type { Clock } from "../../../shared/application/ports/clock";
import { NotFoundError } from "../../../shared/domain/errors";
import type { AgendaEvent } from "../domain/agenda-event";
import { EVENT_NOT_FOUND, type EventUseCaseDeps } from "./agenda-deps";

export type EventLifecycleAction =
  | { type: "archive" }
  | { type: "unarchive" }
  | { type: "postpone"; startsOn: string };

/** Arquivar, desarquivar e adiar (ações de um clique no detalhe e na lista). */
export class EventLifecycleUseCase {
  constructor(private readonly deps: EventUseCaseDeps & { clock: Clock }) {}

  async execute(
    input: { id: string; action: EventLifecycleAction },
    actor: StaffActor,
  ): Promise<void> {
    await this.deps.uow.run(async () => {
      const event = await this.deps.events.findById(input.id);
      if (!event) throw new NotFoundError(EVENT_NOT_FOUND);
      const before = event.toState();
      apply(event, input.action, this.deps.clock.now());
      const changes = diff(before, event.toState());
      if (!hasChanges(changes)) return;
      await this.deps.events.save(event);
      await this.deps.audit.log({
        actor,
        action: `event.${input.action.type}`,
        entityType: "event",
        entityId: event.id,
        changes,
      });
    });
  }
}

function apply(event: AgendaEvent, action: EventLifecycleAction, now: Date): void {
  switch (action.type) {
    case "archive":
      event.archive(now);
      return;
    case "unarchive":
      event.unarchive();
      return;
    case "postpone":
      event.postpone(action.startsOn);
      return;
  }
}

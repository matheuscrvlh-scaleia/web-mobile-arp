import type { StaffActor } from "../../../shared/application/actor";
import { diff, hasChanges } from "../../../shared/application/audit-changes";
import { replacedImageUrls } from "../../../shared/application/image-variants";
import { NotFoundError } from "../../../shared/domain/errors";
import type { AgendaEventChanges } from "../domain/agenda-event";
import { assertReferences, EVENT_NOT_FOUND, type EventUseCaseDeps } from "./agenda-deps";

/** Edita, publica ou cancela. A recorrência é validada no estado final (atual + mudanças). */
export class UpdateEventUseCase {
  constructor(private readonly deps: EventUseCaseDeps) {}

  async execute(input: { id: string; changes: AgendaEventChanges }, actor: StaffActor) {
    const replaced = await this.deps.uow.run(async () => {
      const event = await this.deps.events.findById(input.id);
      if (!event) throw new NotFoundError(EVENT_NOT_FOUND);
      const before = event.toState();
      event.update(input.changes);
      const changes = diff(before, event.toState());
      if (!hasChanges(changes)) return [];
      await assertReferences(this.deps.references, {
        ...(changes.categoryId ? { categoryId: input.changes.categoryId } : {}),
        ...(changes.floorId ? { floorId: input.changes.floorId } : {}),
        ...(changes.storeId ? { storeId: input.changes.storeId } : {}),
      });
      await this.deps.events.save(event);
      await this.deps.audit.log({
        actor,
        action: "event.update",
        entityType: "event",
        entityId: event.id,
        changes,
      });
      return replacedImageUrls(before, event.toState(), ["imageUrl"]);
    });
    await this.deps.images.discard(replaced);
  }
}

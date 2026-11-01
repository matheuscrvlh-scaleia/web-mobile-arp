import type { StaffActor } from "../../../shared/application/actor";
import { diff, hasChanges } from "../../../shared/application/audit-changes";
import { NotFoundError } from "../../../shared/domain/errors";
import type { EventCategoryChanges } from "../domain/event-category";
import { CATEGORY_NOT_FOUND, type EventCategoryUseCaseDeps } from "./agenda-deps";

export class UpdateEventCategoryUseCase {
  constructor(private readonly deps: EventCategoryUseCaseDeps) {}

  async execute(input: { id: string; changes: EventCategoryChanges }, actor: StaffActor) {
    await this.deps.uow.run(async () => {
      const category = await this.deps.categories.findById(input.id);
      if (!category) throw new NotFoundError(CATEGORY_NOT_FOUND);
      const before = category.toState();
      category.update(input.changes);
      const changes = diff(before, category.toState());
      if (!hasChanges(changes)) return;
      await this.deps.categories.save(category);
      await this.deps.audit.log({
        actor,
        action: "event_category.update",
        entityType: "event_category",
        entityId: category.id,
        changes,
      });
    });
  }
}

import type { StaffActor } from "../../../shared/application/actor";
import { snapshot } from "../../../shared/application/audit-changes";
import type { NewEventCategory } from "../domain/event-category";
import type { EventCategoryUseCaseDeps } from "./agenda-deps";

export class CreateEventCategoryUseCase {
  constructor(private readonly deps: EventCategoryUseCaseDeps) {}

  async execute(input: NewEventCategory, actor: StaffActor): Promise<string> {
    return this.deps.uow.run(async () => {
      const category = await this.deps.categories.create(input);
      await this.deps.audit.log({
        actor,
        action: "event_category.create",
        entityType: "event_category",
        entityId: category.id,
        changes: snapshot(category.toState()),
      });
      return category.id;
    });
  }
}

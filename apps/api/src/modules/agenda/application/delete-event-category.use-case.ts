import type { StaffActor } from "../../../shared/application/actor";
import { snapshot } from "../../../shared/application/audit-changes";
import { NotFoundError } from "../../../shared/domain/errors";
import { CATEGORY_NOT_FOUND, type EventCategoryUseCaseDeps } from "./agenda-deps";

/** Apaga categoria sem eventos (com eventos o repositório recusa com CONFLICT). */
export class DeleteEventCategoryUseCase {
  constructor(private readonly deps: EventCategoryUseCaseDeps) {}

  async execute(input: { id: string }, actor: StaffActor): Promise<void> {
    await this.deps.uow.run(async () => {
      const category = await this.deps.categories.findById(input.id);
      if (!category) throw new NotFoundError(CATEGORY_NOT_FOUND);
      await this.deps.categories.delete(category.id);
      await this.deps.audit.log({
        actor,
        action: "event_category.delete",
        entityType: "event_category",
        entityId: category.id,
        changes: snapshot(category.toState()),
      });
    });
  }
}

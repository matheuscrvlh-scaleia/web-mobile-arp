import type { StaffActor } from "../../../shared/application/actor";
import { assertCompleteOrder } from "../domain/highlight";
import type { HighlightUseCaseDeps } from "./marketing-deps";

/** Reordena o carrossel inteiro numa transação. */
export class ReorderHighlightsUseCase {
  constructor(private readonly deps: HighlightUseCaseDeps) {}

  async execute(input: { ids: string[] }, actor: StaffActor): Promise<void> {
    await this.deps.uow.run(async () => {
      const existing = await this.deps.highlights.lockAllIds();
      assertCompleteOrder(input.ids, existing);
      await this.deps.highlights.applyOrder(input.ids);
      await this.deps.audit.log({
        actor,
        action: "highlight.reorder",
        entityType: "highlight",
        entityId: null,
        changes: { order: input.ids },
      });
    });
  }
}

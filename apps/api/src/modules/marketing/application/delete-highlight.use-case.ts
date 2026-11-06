import type { StaffActor } from "../../../shared/application/actor";
import { snapshot } from "../../../shared/application/audit-changes";
import { NotFoundError } from "../../../shared/domain/errors";
import { HIGHLIGHT_NOT_FOUND, type HighlightUseCaseDeps } from "./marketing-deps";

export class DeleteHighlightUseCase {
  constructor(private readonly deps: HighlightUseCaseDeps) {}

  async execute(input: { id: string }, actor: StaffActor): Promise<void> {
    const imageUrl = await this.deps.uow.run(async () => {
      const highlight = await this.deps.highlights.findById(input.id);
      if (!highlight) throw new NotFoundError(HIGHLIGHT_NOT_FOUND);
      highlight.assertDeletable(await this.deps.highlights.impressions(highlight.id));
      await this.deps.highlights.delete(highlight.id);
      await this.deps.audit.log({
        actor,
        action: "highlight.delete",
        entityType: "highlight",
        entityId: highlight.id,
        changes: snapshot(highlight.toState()),
      });
      return highlight.toState().imageUrl;
    });
    await this.deps.images.discard([imageUrl]);
  }
}

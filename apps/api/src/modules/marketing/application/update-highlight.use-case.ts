import type { StaffActor } from "../../../shared/application/actor";
import { diff, hasChanges } from "../../../shared/application/audit-changes";
import { replacedImageUrls } from "../../../shared/application/image-variants";
import { NotFoundError } from "../../../shared/domain/errors";
import type { HighlightChanges } from "../domain/highlight";
import {
  assertHighlightReferences,
  HIGHLIGHT_NOT_FOUND,
  type HighlightUseCaseDeps,
} from "./marketing-deps";

/** Edita (inclui publicar/arquivar). Destino e período validados no estado final. */
export class UpdateHighlightUseCase {
  constructor(private readonly deps: HighlightUseCaseDeps) {}

  async execute(input: { id: string; changes: HighlightChanges }, actor: StaffActor) {
    const replaced = await this.deps.uow.run(async () => {
      const highlight = await this.deps.highlights.findById(input.id);
      if (!highlight) throw new NotFoundError(HIGHLIGHT_NOT_FOUND);
      const before = highlight.toState();
      highlight.update(input.changes);
      const changes = diff(before, highlight.toState());
      if (!hasChanges(changes)) return [];
      await assertHighlightReferences(this.deps.references, highlight.toState(), before);
      await this.deps.highlights.save(highlight);
      await this.deps.audit.log({
        actor,
        action: "highlight.update",
        entityType: "highlight",
        entityId: highlight.id,
        changes,
      });
      return replacedImageUrls(before, highlight.toState(), ["imageUrl"]);
    });
    await this.deps.images.discard(replaced);
  }
}

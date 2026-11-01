import type { StaffActor } from "../../../shared/application/actor";
import { snapshot } from "../../../shared/application/audit-changes";
import { Highlight, type NewHighlight } from "../domain/highlight";
import { assertHighlightReferences, type HighlightUseCaseDeps } from "./marketing-deps";

export class CreateHighlightUseCase {
  constructor(private readonly deps: HighlightUseCaseDeps) {}

  async execute(input: NewHighlight, actor: StaffActor): Promise<string> {
    const data = Highlight.validateNew(input);
    return this.deps.uow.run(async () => {
      await assertHighlightReferences(this.deps.references, data);
      const highlight = await this.deps.highlights.create(data);
      await this.deps.audit.log({
        actor,
        action: "highlight.create",
        entityType: "highlight",
        entityId: highlight.id,
        changes: snapshot(highlight.toState()),
      });
      return highlight.id;
    });
  }
}

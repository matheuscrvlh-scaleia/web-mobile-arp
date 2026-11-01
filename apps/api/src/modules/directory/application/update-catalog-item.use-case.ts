import type { StaffActor } from "../../../shared/application/actor";
import { diff, hasChanges } from "../../../shared/application/audit-changes";
import { NotFoundError } from "../../../shared/domain/errors";
import type { CatalogDeps } from "./catalog-deps";

export class UpdateCatalogItemUseCase<P extends { id: string }> {
  constructor(private readonly deps: CatalogDeps<P>) {}

  async execute(
    input: { id: string; changes: Partial<Omit<P, "id">> },
    actor: StaffActor,
  ): Promise<void> {
    const { repository, audit, uow, entityType, notFoundMessage } = this.deps;
    await uow.run(async () => {
      const item = await repository.findById(input.id);
      if (!item) throw new NotFoundError(notFoundMessage);
      const before = item.toState();
      item.update(input.changes);
      const changes = diff(before, item.toState());
      if (!hasChanges(changes)) return;
      await repository.save(item);
      await audit.log({
        actor,
        action: `${entityType}.update`,
        entityType,
        entityId: item.id,
        changes,
      });
    });
  }
}

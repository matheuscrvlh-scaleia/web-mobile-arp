import type { StaffActor } from "../../../shared/application/actor";
import { snapshot } from "../../../shared/application/audit-changes";
import { NotFoundError } from "../../../shared/domain/errors";
import type { CatalogDeps } from "./catalog-deps";

/** Apaga o cadastro; em uso (lojas, eventos…) o repositório recusa com ConflictError. */
export class DeleteCatalogItemUseCase<P extends { id: string }> {
  constructor(private readonly deps: CatalogDeps<P>) {}

  async execute(input: { id: string }, actor: StaffActor): Promise<void> {
    const { repository, audit, uow, entityType, notFoundMessage } = this.deps;
    await uow.run(async () => {
      const item = await repository.findById(input.id);
      if (!item) throw new NotFoundError(notFoundMessage);
      await repository.delete(item.id);
      await audit.log({
        actor,
        action: `${entityType}.delete`,
        entityType,
        entityId: item.id,
        changes: snapshot(item.toState()),
      });
    });
  }
}

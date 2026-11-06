import type { StaffActor } from "../../../shared/application/actor";
import { snapshot } from "../../../shared/application/audit-changes";
import { NotFoundError, ValidationError } from "../../../shared/domain/errors";
import type { CatalogDeps } from "./catalog-deps";

/**
 * Apaga o cadastro; em uso (lojas, eventos…) o repositório recusa com
 * ConflictError. Com `moveTo` (blocos e categorias), as lojas vão antes
 * para o outro cadastro, na mesma transação.
 */
export class DeleteCatalogItemUseCase<P extends { id: string }> {
  constructor(private readonly deps: CatalogDeps<P>) {}

  async execute(input: { id: string; moveTo?: string | undefined }, actor: StaffActor) {
    const { repository, audit, uow, entityType, notFoundMessage } = this.deps;
    await uow.run(async () => {
      const item = await repository.findById(input.id);
      if (!item) throw new NotFoundError(notFoundMessage);
      let moved = 0;
      if (input.moveTo) {
        if (input.moveTo === item.id || !(await repository.findById(input.moveTo))) {
          throw ValidationError.field("moveTo", "Escolha para onde as lojas vão");
        }
        moved = (await repository.reassignStores?.(item.id, input.moveTo)) ?? 0;
      }
      await repository.delete(item.id);
      await audit.log({
        actor,
        action: `${entityType}.delete`,
        entityType,
        entityId: item.id,
        changes: snapshot({
          ...item.toState(),
          ...(input.moveTo ? { storesMovedTo: input.moveTo, storesMoved: moved } : {}),
        }),
      });
    });
  }
}

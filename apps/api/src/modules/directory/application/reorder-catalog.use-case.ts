import type { StaffActor } from "../../../shared/application/actor";
import { NotFoundError } from "../../../shared/domain/errors";
import type { CatalogDeps } from "./catalog-deps";

/**
 * PUT /<cadastro>/order: grava a ordem que a pessoa arrastou (posição na
 * lista = sort_order). Para categorias, a lista é a de um dos 3 tipos.
 */
export class ReorderCatalogUseCase<P extends { id: string }> {
  constructor(private readonly deps: CatalogDeps<P>) {}

  async execute(input: { ids: readonly string[] }, actor: StaffActor): Promise<void> {
    const { repository, audit, uow, entityType, notFoundMessage } = this.deps;
    await uow.run(async () => {
      const found = (await repository.reorder?.(input.ids)) ?? 0;
      if (found !== input.ids.length) throw new NotFoundError(notFoundMessage);
      await audit.log({
        actor,
        action: `${entityType}.reorder`,
        entityType,
        entityId: input.ids[0] ?? "",
        changes: { order: { from: null, to: input.ids } },
      });
    });
  }
}

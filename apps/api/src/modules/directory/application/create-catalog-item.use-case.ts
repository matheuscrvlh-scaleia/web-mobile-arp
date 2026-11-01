import type { StaffActor } from "../../../shared/application/actor";
import { snapshot } from "../../../shared/application/audit-changes";
import type { CatalogDeps } from "./catalog-deps";

export class CreateCatalogItemUseCase<P extends { id: string }> {
  constructor(private readonly deps: CatalogDeps<P>) {}

  async execute(input: Omit<P, "id">, actor: StaffActor): Promise<string> {
    const { repository, audit, uow, entityType } = this.deps;
    return uow.run(async () => {
      const item = await repository.create(input);
      await audit.log({
        actor,
        action: `${entityType}.create`,
        entityType,
        entityId: item.id,
        changes: snapshot(item.toState()),
      });
      return item.id;
    });
  }
}

import type { StaffActor } from "../../../shared/application/actor";
import { diff, hasChanges } from "../../../shared/application/audit-changes";
import { replacedImageUrls } from "../../../shared/application/image-variants";
import { assertStoreAccess } from "../../../shared/application/store-scope";
import { NotFoundError } from "../../../shared/domain/errors";
import type { StoreChanges } from "../domain/store";
import { assertReferences, STORE_NOT_FOUND, type StoreUseCaseDeps } from "./store-deps";

/** Edição parcial; `hours` presente substitui todos os horários. */
export class UpdateStoreUseCase {
  constructor(private readonly deps: StoreUseCaseDeps) {}

  async execute(input: { id: string; changes: StoreChanges }, actor: StaffActor): Promise<void> {
    const { stores, references, audit, uow, images } = this.deps;
    const replaced = await uow.run(async () => {
      const store = await stores.findById(input.id);
      if (!store) throw new NotFoundError(STORE_NOT_FOUND);
      assertStoreAccess(actor, store.id);
      const { categoryId, extraCategoryIds, blockId, floorId } = input.changes;
      await assertReferences(references, {
        ...(categoryId ? { categoryId } : {}),
        ...(extraCategoryIds ? { extraCategoryIds } : {}),
        ...(blockId ? { blockId } : {}),
        ...(floorId ? { floorId } : {}),
      });

      const before = store.toState();
      store.update(input.changes);
      const changes = diff(before, store.toState());
      if (!hasChanges(changes)) return [];
      await stores.save(store);
      await audit.log({
        actor,
        action: "store.update",
        entityType: "store",
        entityId: store.id,
        changes,
      });
      return replacedImageUrls(before, store.toState(), ["coverImageUrl", "logoUrl"]);
    });
    await images.discard(replaced);
  }
}

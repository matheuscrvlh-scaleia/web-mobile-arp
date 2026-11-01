import type { StaffActor } from "../../../shared/application/actor";
import { assertStoreAccess } from "../../../shared/application/store-scope";
import { NotFoundError } from "../../../shared/domain/errors";
import { STORE_NOT_FOUND, type StoreUseCaseDeps } from "./store-deps";

/** DELETE /stores/:id: some do app, mas o histórico (cupons, selos) fica. */
export class DeactivateStoreUseCase {
  constructor(private readonly deps: StoreUseCaseDeps) {}

  async execute(input: { id: string }, actor: StaffActor): Promise<void> {
    const { stores, audit, uow } = this.deps;
    await uow.run(async () => {
      const store = await stores.findById(input.id);
      if (!store) throw new NotFoundError(STORE_NOT_FOUND);
      assertStoreAccess(actor, store.id);
      if (store.status === "inactive") return;
      store.deactivate();
      await stores.save(store);
      await audit.log({
        actor,
        action: "store.deactivate",
        entityType: "store",
        entityId: store.id,
        changes: { status: { from: "active", to: "inactive" } },
      });
    });
  }
}

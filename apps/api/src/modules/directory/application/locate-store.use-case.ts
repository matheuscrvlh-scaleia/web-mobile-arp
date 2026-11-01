import type { StaffActor } from "../../../shared/application/actor";
import { diff, hasChanges } from "../../../shared/application/audit-changes";
import { assertStoreAccess } from "../../../shared/application/store-scope";
import { NotFoundError } from "../../../shared/domain/errors";
import { assertReferences, STORE_NOT_FOUND, type StoreUseCaseDeps } from "./store-deps";

/** PUT /stores/:id/location: posiciona o pino (e opcionalmente muda o andar). */
export class LocateStoreUseCase {
  constructor(private readonly deps: StoreUseCaseDeps) {}

  async execute(
    input: { id: string; floorId?: string; mapX: number | null; mapY: number | null },
    actor: StaffActor,
  ): Promise<void> {
    const { stores, references, audit, uow } = this.deps;
    await uow.run(async () => {
      const store = await stores.findById(input.id);
      if (!store) throw new NotFoundError(STORE_NOT_FOUND);
      assertStoreAccess(actor, store.id);
      if (input.floorId) await assertReferences(references, { floorId: input.floorId });

      const before = store.toState();
      store.locate({
        ...(input.floorId ? { floorId: input.floorId } : {}),
        mapX: input.mapX,
        mapY: input.mapY,
      });
      const changes = diff(before, store.toState());
      if (!hasChanges(changes)) return;
      await stores.save(store);
      await audit.log({
        actor,
        action: "store.locate",
        entityType: "store",
        entityId: store.id,
        changes,
      });
    });
  }
}

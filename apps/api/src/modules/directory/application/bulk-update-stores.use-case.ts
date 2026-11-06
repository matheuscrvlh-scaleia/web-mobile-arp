import type { StaffActor } from "../../../shared/application/actor";
import { diff, hasChanges } from "../../../shared/application/audit-changes";
import { assertStoreAccess } from "../../../shared/application/store-scope";
import { NotFoundError } from "../../../shared/domain/errors";
import type { StoreStatus } from "../domain/store";
import { assertReferences, type StoreUseCaseDeps } from "./store-deps";

export interface BulkStoreChanges {
  categoryId?: string | undefined;
  blockId?: string | undefined;
  floorId?: string | undefined;
  status?: StoreStatus | undefined;
}

/**
 * POST /stores/bulk: a mesma mudança em várias lojas, tudo ou nada (uma
 * transação). Passa pela entidade (trocar o andar tira do mapa) e registra
 * no histórico loja por loja. Devolve quantas mudaram de fato.
 */
export class BulkUpdateStoresUseCase {
  constructor(private readonly deps: StoreUseCaseDeps) {}

  async execute(
    input: { ids: readonly string[]; changes: BulkStoreChanges },
    actor: StaffActor,
  ): Promise<number> {
    const { stores, references, audit, uow } = this.deps;
    const { categoryId, blockId, floorId, status } = input.changes;
    const changes = {
      ...(categoryId ? { categoryId } : {}),
      ...(blockId ? { blockId } : {}),
      ...(floorId ? { floorId } : {}),
      ...(status ? { status } : {}),
    };
    return uow.run(async () => {
      await assertReferences(references, changes);
      let updated = 0;
      for (const id of input.ids) {
        const store = await stores.findById(id);
        if (!store) throw new NotFoundError("Uma das lojas não existe mais. Recarregue a lista.");
        assertStoreAccess(actor, store.id);
        const before = store.toState();
        store.update(changes);
        const changed = diff(before, store.toState());
        if (!hasChanges(changed)) continue;
        await stores.save(store);
        await audit.log({
          actor,
          action: "store.update",
          entityType: "store",
          entityId: store.id,
          changes: changed,
        });
        updated++;
      }
      return updated;
    });
  }
}

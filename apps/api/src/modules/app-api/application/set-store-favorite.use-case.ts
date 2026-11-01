import type { VisitorActor } from "../../../shared/application/actor";
import { NotFoundError } from "../../../shared/domain/errors";
import type { EngagementRepository } from "../domain/repositories";

/** Favoritar/desfavoritar loja. Idempotente; só lojas ativas podem ser favoritadas. */
export class SetStoreFavoriteUseCase {
  constructor(private readonly deps: { engagement: EngagementRepository }) {}

  async execute(input: { storeId: string; on: boolean }, actor: VisitorActor): Promise<void> {
    const { engagement } = this.deps;
    if (input.on && !(await engagement.isStoreActive(input.storeId))) {
      throw new NotFoundError("Loja não encontrada");
    }
    await engagement.setFavorite(actor.id, input.storeId, input.on);
  }
}

import type { VisitorActor } from "../../../shared/application/actor";
import { NotFoundError } from "../../../shared/domain/errors";
import type { EngagementRepository } from "../domain/repositories";

/** "Avisar ofertas" da loja (público store_followers das notificações). Idempotente. */
export class SetStoreFollowUseCase {
  constructor(private readonly deps: { engagement: EngagementRepository }) {}

  async execute(input: { storeId: string; on: boolean }, actor: VisitorActor): Promise<void> {
    const { engagement } = this.deps;
    if (input.on && !(await engagement.isStoreActive(input.storeId))) {
      throw new NotFoundError("Loja não encontrada");
    }
    await engagement.setFollow(actor.id, input.storeId, input.on);
  }
}

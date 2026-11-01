import type { StaffActor } from "../../../shared/application/actor";
import { diff } from "../../../shared/application/audit-changes";
import { NotFoundError } from "../../../shared/domain/errors";
import { assertClaimFromStore } from "../domain/claim";
import type { PromotionsDeps } from "./promotions-deps";

export const CODE_NOT_FOUND = "Código não encontrado";

/**
 * Validação do código no caixa. A linha do pego fica travada (FOR UPDATE):
 * dois caixas validando o mesmo código ao mesmo tempo → só um consegue.
 */
export class RedeemClaimUseCase {
  constructor(private readonly deps: PromotionsDeps) {}

  async execute(input: { code: string }, actor: StaffActor): Promise<{ claimId: string }> {
    const { claims, audit, clock, uow } = this.deps;
    return uow.run(async () => {
      const found = await claims.findByCodeForUpdate(input.code);
      if (!found) throw new NotFoundError(CODE_NOT_FOUND);
      assertClaimFromStore(actor.storeId, found.storeId);

      const { claim } = found;
      const before = claim.toState();
      claim.redeem(actor.id, clock.now());
      await claims.save(claim);
      await audit.log({
        actor,
        action: "claim.redeem",
        entityType: "claim",
        entityId: claim.id,
        changes: diff(before, claim.toState()),
      });
      return { claimId: claim.id };
    });
  }
}

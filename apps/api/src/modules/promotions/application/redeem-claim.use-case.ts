import type { StaffActor } from "../../../shared/application/actor";
import { diff } from "../../../shared/application/audit-changes";
import { NotFoundError } from "../../../shared/domain/errors";
import { toLocal } from "../../../shared/domain/time";
import { assertClaimFromStore } from "../domain/claim";
import { ClaimWrongDayError } from "../domain/errors";
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
      const now = clock.now();
      claim.redeem(actor.id, now);
      // Fase 2: fora dos dias escolhidos (no fuso da ARP), recusa, mesmo dentro do prazo.
      if (!found.weekdays.includes(toLocal(now).weekday)) {
        throw new ClaimWrongDayError(found.weekdays);
      }
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

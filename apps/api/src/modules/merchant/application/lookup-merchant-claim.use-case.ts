import type { App } from "@arp/contracts";
import type { StaffActor } from "../../../shared/application/actor";
import { type MerchantClaimsDeps, toMerchantClaim } from "./merchant-claims";
import { actingInStore, resolveMerchantStore } from "./merchant-scope";

/**
 * Consulta o código no caixa do app. Reusa o caso de uso do painel com o
 * ator preso à loja escolhida: mesmos erros (NOT_FOUND, CLAIM_WRONG_STORE).
 */
export class LookupMerchantClaimUseCase {
  constructor(private readonly deps: MerchantClaimsDeps) {}

  async execute(
    input: { code: string; storeId?: string | undefined },
    actor: StaffActor,
  ): Promise<App.MerchantClaim> {
    const storeId = await resolveMerchantStore(actor, input.storeId, this.deps.stores);
    const claim = await this.deps.lookup.execute(
      { code: input.code },
      actingInStore(actor, storeId),
    );
    return toMerchantClaim(claim);
  }
}

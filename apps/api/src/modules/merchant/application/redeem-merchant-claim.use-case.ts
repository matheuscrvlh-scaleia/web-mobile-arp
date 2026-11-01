import type { App } from "@arp/contracts";
import type { StaffActor } from "../../../shared/application/actor";
import type { Cache } from "../../../shared/application/ports/cache";
import { NotFoundError } from "../../../shared/domain/errors";
import { overviewCachePrefix } from "./get-merchant-overview.use-case";
import { type MerchantClaimsDeps, toMerchantClaim } from "./merchant-claims";
import { actingInStore, resolveMerchantStore } from "./merchant-scope";

/**
 * Usa o código no caixa do app. Reusa o caso de uso do painel (trava da
 * linha, regras do pego, auditoria `claim.redeem` na mesma transação) com o
 * ator preso à loja escolhida: mesmos erros (NOT_FOUND,
 * CLAIM_ALREADY_REDEEMED, CLAIM_EXPIRED, CLAIM_CANCELLED, CLAIM_WRONG_STORE).
 */
export class RedeemMerchantClaimUseCase {
  constructor(private readonly deps: MerchantClaimsDeps & { cache: Cache }) {}

  async execute(
    input: { code: string; storeId?: string | undefined },
    actor: StaffActor,
  ): Promise<App.MerchantClaim> {
    const storeId = await resolveMerchantStore(actor, input.storeId, this.deps.stores);
    const { claimId } = await this.deps.redeem.execute(
      { code: input.code },
      actingInStore(actor, storeId),
    );
    // O lojista olha os números logo depois de usar o código: sem esperar o TTL.
    this.deps.cache.invalidate(overviewCachePrefix(storeId));
    const claim = await this.deps.claimById(claimId);
    if (!claim) throw new NotFoundError("Código não encontrado");
    return toMerchantClaim(claim);
  }
}

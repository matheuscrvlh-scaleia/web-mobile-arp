import type { CouponClaim } from "@arp/contracts";
import type { StaffActor } from "../../../shared/application/actor";
import { NotFoundError } from "../../../shared/domain/errors";
import { assertClaimFromStore } from "../domain/claim";
import { CODE_NOT_FOUND } from "./redeem-claim.use-case";

/** Leitura do pego pelo código (query service). */
export interface ClaimReader {
  claimByCode(code: string): Promise<CouponClaim | null>;
}

/** Consulta o código antes de confirmar no caixa (lojista: só da própria loja). */
export class LookupClaimUseCase {
  constructor(private readonly deps: { reader: ClaimReader }) {}

  async execute(input: { code: string }, actor: StaffActor): Promise<CouponClaim> {
    const claim = await this.deps.reader.claimByCode(input.code);
    if (!claim) throw new NotFoundError(CODE_NOT_FOUND);
    assertClaimFromStore(actor.storeId, claim.store.id);
    return claim;
  }
}

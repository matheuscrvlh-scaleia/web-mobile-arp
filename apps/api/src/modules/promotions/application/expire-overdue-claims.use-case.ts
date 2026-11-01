import type { Clock } from "../../../shared/application/ports/clock";
import type { ClaimRepository } from "../domain/repositories";

const BATCH_SIZE = 500;

/**
 * Materializa `expired` nos pegos vencidos (a leitura já os trata como
 * devolvidos; isto serve aos relatórios e libera o unique parcial).
 * Lotes pequenos: cada um é uma transação curta.
 */
export class ExpireOverdueClaimsUseCase {
  constructor(private readonly deps: { claims: ClaimRepository; clock: Clock }) {}

  async execute(): Promise<number> {
    let total = 0;
    for (;;) {
      const expired = await this.deps.claims.expireOverdueBatch(this.deps.clock.now(), BATCH_SIZE);
      total += expired;
      if (expired < BATCH_SIZE) return total;
    }
  }
}

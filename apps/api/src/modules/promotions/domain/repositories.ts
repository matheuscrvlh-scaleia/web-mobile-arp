import type { Claim, NewClaim } from "./claim";
import type { Coupon, NewCoupon } from "./coupon";

export interface CouponRepository {
  findById(id: string): Promise<Coupon | null>;
  /** Trava a linha do cupom: serializa pegos e edições de estoque do mesmo cupom. */
  findByIdForUpdate(id: string): Promise<Coupon | null>;
  create(data: NewCoupon): Promise<Coupon>;
  save(coupon: Coupon): Promise<void>;
  /** Unidades ocupadas agora: ativos dentro do prazo + usados. */
  countTaken(couponId: string, now: Date): Promise<number>;
}

export interface ClaimWithStore {
  claim: Claim;
  storeId: string;
}

export interface ClaimRepository {
  /** Pelo código, com trava de linha (validação no caixa). */
  findByCodeForUpdate(code: string): Promise<ClaimWithStore | null>;
  /**
   * Preparação do "pegar" numa ida ao banco (com o cupom já travado):
   * expira o ativo vencido do visitante (ele ainda ocuparia o unique parcial
   * "um ativo por visitante" até o job rodar), conta as unidades ocupadas e
   * diz se ele já tem um ativo no prazo.
   */
  claimSlot(
    couponId: string,
    visitorId: string,
    now: Date,
  ): Promise<{ taken: number; hasActive: boolean }>;
  /**
   * ClaimCodeCollisionError se o código já existir;
   * CouponAlreadyClaimedError se o visitante já tiver um ativo (corrida).
   */
  insert(data: NewClaim): Promise<Claim>;
  save(claim: Claim): Promise<void>;
  /** Job: materializa `expired` nos ativos vencidos, em lote. Devolve quantos. */
  expireOverdueBatch(now: Date, limit: number): Promise<number>;
}

export interface StoreLookup {
  exists(storeId: string): Promise<boolean>;
}

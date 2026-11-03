import { DomainError } from "../../../shared/domain/errors";

export class CouponSoldOutError extends DomainError {
  override readonly name = "CouponSoldOutError";
  constructor() {
    super("COUPON_SOLD_OUT", "Esse cupom acabou de esgotar", 409);
  }
}

export class CouponNotAvailableError extends DomainError {
  override readonly name = "CouponNotAvailableError";
  constructor() {
    super("COUPON_NOT_AVAILABLE", "Esse cupom não está disponível agora", 422);
  }
}

export class CouponAlreadyClaimedError extends DomainError {
  override readonly name = "CouponAlreadyClaimedError";
  constructor() {
    super("COUPON_ALREADY_CLAIMED", "Você já tem este cupom ativo na carteira", 409);
  }
}

export class ClaimAlreadyRedeemedError extends DomainError {
  override readonly name = "ClaimAlreadyRedeemedError";
  constructor() {
    super("CLAIM_ALREADY_REDEEMED", "Este código já foi usado", 409);
  }
}

export class ClaimExpiredError extends DomainError {
  override readonly name = "ClaimExpiredError";
  constructor() {
    super("CLAIM_EXPIRED", "Este código venceu", 410);
  }
}

export class ClaimCancelledError extends DomainError {
  override readonly name = "ClaimCancelledError";
  constructor() {
    super("CLAIM_CANCELLED", "Este código foi cancelado", 409);
  }
}

const WEEKDAY_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** Cupom usado fora dos dias escolhidos pelo lojista (Fase 2). */
export class ClaimWrongDayError extends DomainError {
  override readonly name = "ClaimWrongDayError";
  constructor(weekdays: readonly number[]) {
    const days = [...weekdays.filter((d) => d !== 0), ...weekdays.filter((d) => d === 0)]
      .map((d) => WEEKDAY_SHORT[d])
      .join(", ");
    super("CLAIM_WRONG_DAY", `Recusado: este cupom só vale ${days}`, 422);
  }
}

export class ClaimWrongStoreError extends DomainError {
  override readonly name = "ClaimWrongStoreError";
  constructor() {
    super("CLAIM_WRONG_STORE", "Este código é de outra loja", 403);
  }
}

/** Colisão do código ARP-XXXXXX (raríssima): o caso de uso sorteia outro. */
export class ClaimCodeCollisionError extends Error {
  override readonly name = "ClaimCodeCollisionError";
}

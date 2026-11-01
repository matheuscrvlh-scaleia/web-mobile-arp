import { DomainError } from "../../../shared/domain/errors";

export class QrInvalidError extends DomainError {
  override readonly name = "QrInvalidError";
  constructor() {
    super("QR_INVALID", "Este QR Code não é de um desafio da ARP", 422);
  }
}

export class QrExpiredError extends DomainError {
  override readonly name = "QrExpiredError";
  constructor() {
    super("QR_EXPIRED", "Este QR Code expirou: o desafio não está mais valendo", 410);
  }
}

export class SealAlreadyEarnedError extends DomainError {
  override readonly name = "SealAlreadyEarnedError";
  constructor() {
    super("SEAL_ALREADY_EARNED", "Você já ganhou este selo", 409);
  }
}

/** Colisão de token de QR (raríssima): o caso de uso sorteia outro. */
export class QrTokenCollisionError extends Error {
  override readonly name = "QrTokenCollisionError";
}

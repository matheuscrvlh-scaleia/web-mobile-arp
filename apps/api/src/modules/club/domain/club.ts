import type { PrizeKind } from "@arp/contracts";
import { DomainError } from "../../../shared/domain/errors";

/** Prêmio da lojinha do Clube ARP (cadastro simples). */
export interface PrizeProps {
  id: string;
  name: string;
  description: string;
  kind: PrizeKind;
  points: number;
  stock: number;
  imageUrl: string | null;
  active: boolean;
  sortOrder: number;
}

export class PrizeOutOfStockError extends DomainError {
  override readonly name = "PrizeOutOfStockError";
  constructor() {
    super("PRIZE_OUT_OF_STOCK", "Esse prêmio acabou", 409);
  }
}

export class NotEnoughPointsError extends DomainError {
  override readonly name = "NotEnoughPointsError";
  constructor(missing: number) {
    super("NOT_ENOUGH_POINTS", `Faltam ${missing} pontos para este prêmio`, 422, { missing });
  }
}

/** Código de retirada: sem 0/O, 1/I (lido em voz alta no balcão). */
export const REDEMPTION_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const REDEMPTION_CODE_LENGTH = 6;
export const PRIZE_NOT_FOUND = "Prêmio não encontrado";
export const REDEMPTION_NOT_FOUND = "Troca não encontrada";

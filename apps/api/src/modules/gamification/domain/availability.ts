import { ValidationError } from "../../../shared/domain/errors";

/**
 * Janela opcional em que um desafio ou selo dá selo (início inclusivo, fim
 * exclusivo). Vazio dos dois lados: vale sempre (no desafio, vale a campanha).
 */
export interface Availability {
  availableFrom: Date | null;
  availableUntil: Date | null;
}

export function isAvailableAt(a: Availability, now: Date): boolean {
  return (
    (a.availableFrom === null || a.availableFrom <= now) &&
    (a.availableUntil === null || now < a.availableUntil)
  );
}

export function assertAvailability(a: Availability): void {
  if (a.availableFrom && a.availableUntil && a.availableUntil <= a.availableFrom) {
    throw ValidationError.field("availableUntil", "O fim precisa ser depois do início");
  }
}

import type { SecureRandom } from "../../../shared/application/ports/secure-random";

/** Sem caracteres ambíguos (0/O, 1/l/I), para ditar por telefone sem erro. */
const LETTERS = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz";
const DIGITS = "23456789";
const LENGTH = 14;

/**
 * Senha provisória forte (≈ 80 bits) que passa na regra do painel (letra e
 * número). Mostrada uma única vez; o usuário é obrigado a trocar.
 */
export function generateTemporaryPassword(random: SecureRandom): string {
  for (;;) {
    const password = random.string(LETTERS + DIGITS, LENGTH);
    if (/[A-Za-z]/.test(password) && /\d/.test(password)) return password;
  }
}

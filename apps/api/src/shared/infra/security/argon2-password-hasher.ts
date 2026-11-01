import { hash, verify } from "@node-rs/argon2";
import type { PasswordHasher } from "../../application/ports/password-hasher";

/** argon2id com os parâmetros mínimos da OWASP (19 MiB, t=2, p=1) — os mesmos do seed. */
const OPTIONS = { algorithm: 2 /* Argon2id */, memoryCost: 19_456, timeCost: 2, parallelism: 1 };

export class Argon2PasswordHasher implements PasswordHasher {
  hash(plain: string): Promise<string> {
    return hash(plain, OPTIONS);
  }

  async verify(passwordHash: string, plain: string): Promise<boolean> {
    try {
      // A comparação do digest é feita em tempo constante pela própria lib.
      return await verify(passwordHash, plain);
    } catch {
      return false;
    }
  }
}

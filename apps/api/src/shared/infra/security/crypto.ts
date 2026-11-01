import { createHash, randomBytes, randomInt } from "node:crypto";
import type { SecureRandom } from "../../application/ports/secure-random";
import type { OpaqueTokenGenerator } from "../../application/ports/token-service";

export class CryptoSecureRandom implements SecureRandom {
  int(max: number): number {
    return randomInt(max);
  }

  token(bytes: number): string {
    return randomBytes(bytes).toString("base64url");
  }

  string(alphabet: string, length: number): string {
    let out = "";
    for (let i = 0; i < length; i++) out += alphabet[randomInt(alphabet.length)];
    return out;
  }
}

/** Refresh token: 32 bytes aleatórios; no banco só o SHA-256 (hex). */
export class Sha256OpaqueTokenGenerator implements OpaqueTokenGenerator {
  generate(): { token: string; hash: string } {
    const token = randomBytes(32).toString("base64url");
    return { token, hash: this.hash(token) };
  }

  hash(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }
}

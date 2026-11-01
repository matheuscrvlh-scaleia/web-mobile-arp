import { createHmac, timingSafeEqual } from "node:crypto";
import type { ResetCodeHasher } from "../application/password-reset";

/**
 * HMAC-SHA256 de "<visitorId>:<código>". A chave é derivada do segredo com
 * um rótulo próprio (o mesmo segredo pode ser o JWT_ACCESS_SECRET sem que as
 * duas assinaturas se confundam).
 */
export class HmacResetCodeHasher implements ResetCodeHasher {
  private readonly key: Buffer;

  constructor(secret: string) {
    this.key = createHmac("sha256", secret).update("arp:password-reset:v1").digest();
  }

  hash(visitorId: string, code: string): string {
    return createHmac("sha256", this.key).update(`${visitorId}:${code}`).digest("hex");
  }

  matches(visitorId: string, code: string, hash: string): boolean {
    const expected = Buffer.from(this.hash(visitorId, code), "hex");
    const given = Buffer.from(hash, "hex");
    return expected.length === given.length && timingSafeEqual(expected, given);
  }
}

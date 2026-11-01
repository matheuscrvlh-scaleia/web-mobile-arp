import { errors, type JWTPayload, jwtVerify, SignJWT } from "jose";
import type {
  AccessClaims,
  SignedAccessToken,
  TokenAudience,
  TokenService,
} from "../../application/ports/token-service";
import { UnauthenticatedError } from "../../domain/errors";

export interface JoseTokenServiceOptions {
  secret: string;
  issuer: string;
  accessTtlSeconds: number;
}

interface Payload extends JWTPayload {
  sid?: unknown;
  name?: unknown;
  role?: unknown;
  perms?: unknown;
  store?: unknown;
}

/** JWT HS256 com aud ("admin" ou "app"), iss e exp validados. */
export class JoseTokenService implements TokenService {
  private readonly key: Uint8Array;

  constructor(private readonly options: JoseTokenServiceOptions) {
    this.key = new TextEncoder().encode(options.secret);
  }

  async signAccessToken(claims: AccessClaims): Promise<SignedAccessToken> {
    const payload: Payload = { sid: claims.sessionId, name: claims.name };
    if (claims.audience === "admin") {
      payload.role = claims.roleId;
      payload.perms = claims.permissions;
      payload.store = claims.storeId;
    }
    const token = await new SignJWT(payload)
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setSubject(claims.subject)
      .setAudience(claims.audience)
      .setIssuer(this.options.issuer)
      .setIssuedAt()
      .setExpirationTime(`${this.options.accessTtlSeconds}s`)
      .sign(this.key);
    return { token, expiresIn: this.options.accessTtlSeconds };
  }

  async verifyAccessToken<A extends TokenAudience>(
    token: string,
    audience: A,
  ): Promise<Extract<AccessClaims, { audience: A }>> {
    let payload: Payload;
    try {
      ({ payload } = await jwtVerify<Payload>(token, this.key, {
        algorithms: ["HS256"],
        audience,
        issuer: this.options.issuer,
        requiredClaims: ["sub", "exp", "iat"],
      }));
    } catch (err) {
      if (err instanceof errors.JWTExpired) {
        throw new UnauthenticatedError("Sessão expirada", "TOKEN_EXPIRED");
      }
      throw new UnauthenticatedError("Token inválido");
    }
    return toClaims(payload, audience) as Extract<AccessClaims, { audience: A }>;
  }
}

function toClaims(payload: Payload, audience: TokenAudience): AccessClaims {
  const { sub, sid, name } = payload;
  if (typeof sub !== "string" || typeof sid !== "string" || typeof name !== "string") {
    throw new UnauthenticatedError("Token inválido");
  }
  if (audience === "app") return { audience, subject: sub, sessionId: sid, name };

  const { role, perms, store } = payload;
  if (
    typeof role !== "string" ||
    !Array.isArray(perms) ||
    !perms.every((p) => typeof p === "string") ||
    !(store === null || typeof store === "string")
  ) {
    throw new UnauthenticatedError("Token inválido");
  }
  return {
    audience,
    subject: sub,
    sessionId: sid,
    name,
    roleId: role,
    permissions: perms,
    storeId: store,
  };
}

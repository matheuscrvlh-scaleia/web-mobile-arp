export type TokenAudience = "admin" | "app";

export interface StaffAccessClaims {
  audience: "admin";
  subject: string;
  sessionId: string;
  name: string;
  roleId: string;
  permissions: string[];
  storeId: string | null;
}

export interface VisitorAccessClaims {
  audience: "app";
  subject: string;
  sessionId: string;
  name: string;
}

export type AccessClaims = StaffAccessClaims | VisitorAccessClaims;

export interface SignedAccessToken {
  token: string;
  /** Segundos até expirar. */
  expiresIn: number;
}

/** Access token curto (JWT). Verificar lança UnauthenticatedError (TOKEN_EXPIRED quando venceu). */
export interface TokenService {
  signAccessToken(claims: AccessClaims): Promise<SignedAccessToken>;
  verifyAccessToken<A extends TokenAudience>(
    token: string,
    audience: A,
  ): Promise<Extract<AccessClaims, { audience: A }>>;
}

/** Refresh token opaco: só o hash vai para o banco. */
export interface OpaqueTokenGenerator {
  generate(): { token: string; hash: string };
  hash(token: string): string;
}

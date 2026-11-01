import { createHash } from "node:crypto";
import { createRemoteJWKSet, errors, type JWTPayload, type JWTVerifyGetKey, jwtVerify } from "jose";
import { ServiceUnavailableError, UnauthenticatedError } from "../../../shared/domain/errors";
import type { SocialIdentity, SocialIdentityVerifier } from "../application/social-identity";
import type { SocialProvider } from "../domain/visitor-account";

export interface SocialProviderConfig {
  /** Chaves públicas do provedor (remota em produção; local nos testes). */
  jwks: JWTVerifyGetKey;
  issuers: string[];
  /** Client ids do app (um por plataforma). Vazio = provedor desligado. */
  audiences: string[];
}

interface WarnLogger {
  warn(obj: object, msg?: string): void;
}

const LABEL: Record<SocialProvider, string> = { google: "Google", apple: "Apple" };

export const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
export const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
export const APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys";
export const APPLE_ISSUERS = ["https://appleid.apple.com"];

/** Valida id_tokens do Google/Apple com jose (RS256 + JWKS do provedor). */
export class JoseSocialIdentityVerifier implements SocialIdentityVerifier {
  constructor(
    private readonly providers: Record<SocialProvider, SocialProviderConfig>,
    private readonly logger?: WarnLogger,
  ) {}

  async verify(provider: SocialProvider, idToken: string, nonce?: string): Promise<SocialIdentity> {
    const config = this.providers[provider];
    if (config.audiences.length === 0) {
      throw new ServiceUnavailableError(
        `Entrar com ${LABEL[provider]} não está disponível no momento.`,
      );
    }
    const invalid = () =>
      new UnauthenticatedError(
        `Não foi possível confirmar seu login com ${LABEL[provider]}. Tente de novo.`,
        "INVALID_CREDENTIALS",
      );

    let payload: JWTPayload;
    try {
      ({ payload } = await jwtVerify(idToken, config.jwks, {
        issuer: config.issuers,
        audience: config.audiences,
        algorithms: ["RS256"],
        clockTolerance: 30,
      }));
    } catch (err) {
      if (err instanceof errors.JOSEError && !(err instanceof errors.JWKSTimeout)) throw invalid();
      // Rede ou JWKS fora do ar: não é culpa do token.
      this.logger?.warn({ err, provider }, "Falha ao buscar as chaves do login social");
      throw new ServiceUnavailableError(
        `Não foi possível falar com ${LABEL[provider]} agora. Tente de novo em instantes.`,
      );
    }

    if (nonce !== undefined && !nonceMatches(nonce, payload.nonce)) throw invalid();
    const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
    // A Apple manda email_verified como string ("true").
    const verified = payload.email_verified === true || payload.email_verified === "true";
    if (!payload.sub || !email || !verified) throw invalid();

    const name =
      typeof payload.name === "string" && payload.name.trim() ? payload.name.trim() : null;
    return { subject: payload.sub, email, name };
  }
}

/**
 * Igual ao claim, ou o SHA-256 (hex) dele: no Sign in with Apple o app manda
 * o hash para a Apple e pode repassar aqui o nonce cru.
 */
function nonceMatches(nonce: string, claim: unknown): boolean {
  if (typeof claim !== "string") return false;
  return claim === nonce || claim === createHash("sha256").update(nonce).digest("hex");
}

/** Verificador de produção: JWKS remotas (buscadas na 1ª chamada e guardadas em cache pelo jose). */
export function createSocialIdentityVerifier(
  clientIds: Record<SocialProvider, string[]>,
  logger?: WarnLogger,
): JoseSocialIdentityVerifier {
  const remote = (url: string) =>
    createRemoteJWKSet(new URL(url), { timeoutDuration: 5_000, cooldownDuration: 30_000 });
  return new JoseSocialIdentityVerifier(
    {
      google: {
        jwks: remote(GOOGLE_JWKS_URL),
        issuers: GOOGLE_ISSUERS,
        audiences: clientIds.google,
      },
      apple: { jwks: remote(APPLE_JWKS_URL), issuers: APPLE_ISSUERS, audiences: clientIds.apple },
    },
    logger,
  );
}

import type { SocialProvider } from "../domain/visitor-account";

/** O que o app aproveita do id_token já validado. */
export interface SocialIdentity {
  /** Claim "sub": id estável do usuário no provedor. */
  subject: string;
  /** Sempre verificado pelo provedor (email_verified). */
  email: string;
  /** Claim "name" (o Google manda; a Apple não). */
  name: string | null;
}

/**
 * Valida o id_token do Google/Apple: assinatura (JWKS do provedor), emissor,
 * audiência (client ids do app), validade e, se informado, o nonce.
 * Token inválido → UnauthenticatedError (INVALID_CREDENTIALS); provedor sem
 * client id configurado ou JWKS fora do ar → ServiceUnavailableError.
 */
export interface SocialIdentityVerifier {
  verify(provider: SocialProvider, idToken: string, nonce?: string): Promise<SocialIdentity>;
}

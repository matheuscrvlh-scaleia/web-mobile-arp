import { DomainError } from "../../../shared/domain/errors";
import type { AuthProvider } from "./visitor-account";

const HOW_TO_ENTER: Record<AuthProvider, string> = {
  password: "Este e-mail já tem conta com senha. Entre com e-mail e senha.",
  google: "Este e-mail já tem conta com o Google. Entre com o Google.",
  apple: "Este e-mail já tem conta com a Apple. Entre com a Apple.",
};

/** Login social com e-mail de conta de outro método (uma conta = um método; não vincula). */
export class EmailUsesOtherLoginError extends DomainError {
  override readonly name = "EmailUsesOtherLoginError";
  constructor(provider: AuthProvider) {
    super("EMAIL_USES_OTHER_LOGIN", HOW_TO_ENTER[provider], 409, { provider });
  }
}

/** Conta nova pelo login social sem aceite dos termos: o app mostra os termos e reenvia. */
export class TermsRequiredError extends DomainError {
  override readonly name = "TermsRequiredError";
  constructor() {
    super(
      "TERMS_REQUIRED",
      "Aceite os termos de uso e a política de privacidade para criar sua conta.",
      422,
    );
  }
}

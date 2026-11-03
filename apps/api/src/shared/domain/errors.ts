/**
 * Erros de domínio. Cada um carrega o código da API (o mesmo de ERROR_CODES
 * no @arp/contracts — conferido em tempo de compilação no error handler) e o
 * status HTTP. O domínio não conhece Fastify: só diz "o que" deu errado.
 */
export type DomainErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "INVALID_CREDENTIALS"
  | "TOKEN_EXPIRED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "BUSINESS_RULE"
  | "RATE_LIMITED"
  | "PAYLOAD_TOO_LARGE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "INTERNAL_ERROR"
  | "SERVICE_UNAVAILABLE"
  | "EMAIL_USES_OTHER_LOGIN"
  | "TERMS_REQUIRED"
  | "COUPON_SOLD_OUT"
  | "COUPON_NOT_AVAILABLE"
  | "COUPON_ALREADY_CLAIMED"
  | "CLAIM_ALREADY_REDEEMED"
  | "CLAIM_EXPIRED"
  | "CLAIM_CANCELLED"
  | "CLAIM_WRONG_STORE"
  | "CLAIM_WRONG_DAY"
  | "QR_INVALID"
  | "QR_EXPIRED"
  | "SEAL_ALREADY_EARNED";

/** Erros por campo: { campo: [mensagens] } (mesmo formato do VALIDATION_ERROR do Zod). */
export type FieldErrors = Record<string, string[]>;

export class DomainError extends Error {
  override readonly name: string = "DomainError";

  constructor(
    readonly code: DomainErrorCode,
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export class ValidationError extends DomainError {
  override readonly name = "ValidationError";
  constructor(message: string, fieldErrors?: FieldErrors) {
    super("VALIDATION_ERROR", message, 400, fieldErrors);
  }

  /** Um campo só: new ValidationError.field("endsOn", "O fim precisa ser depois do início"). */
  static field(field: string, message: string): ValidationError {
    return new ValidationError(message, { [field]: [message] });
  }
}

export class UnauthenticatedError extends DomainError {
  override readonly name = "UnauthenticatedError";
  constructor(
    message = "Faça login para continuar",
    code: "UNAUTHENTICATED" | "INVALID_CREDENTIALS" | "TOKEN_EXPIRED" = "UNAUTHENTICATED",
  ) {
    super(code, message, 401);
  }
}

export class ForbiddenError extends DomainError {
  override readonly name = "ForbiddenError";
  constructor(message = "Você não tem permissão para esta ação") {
    super("FORBIDDEN", message, 403);
  }
}

export class NotFoundError extends DomainError {
  override readonly name = "NotFoundError";
  constructor(message = "Registro não encontrado") {
    super("NOT_FOUND", message, 404);
  }
}

export class ConflictError extends DomainError {
  override readonly name = "ConflictError";
  constructor(message: string, details?: unknown) {
    super("CONFLICT", message, 409, details);
  }
}

/** Regra de negócio violada (a entrada é válida, mas o estado atual não permite). */
export class BusinessRuleError extends DomainError {
  override readonly name = "BusinessRuleError";
  constructor(message: string, details?: unknown) {
    super("BUSINESS_RULE", message, 422, details);
  }
}

/** Dependência externa fora do ar ou não configurada (e-mail, login social). */
export class ServiceUnavailableError extends DomainError {
  override readonly name = "ServiceUnavailableError";
  constructor(message: string) {
    super("SERVICE_UNAVAILABLE", message, 503);
  }
}

/** O valor encontrado, ou NotFoundError (leituras do tipo "busca ou 404"). */
export function orNotFound<T>(value: T | null | undefined, message?: string): T {
  if (value === null || value === undefined) throw new NotFoundError(message);
  return value;
}

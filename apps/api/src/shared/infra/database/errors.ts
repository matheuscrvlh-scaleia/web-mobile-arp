import pg from "pg";

/**
 * Helpers para reconhecer erros do Postgres. A camada de aplicação/infra
 * traduz para erros de domínio (ex.: unique em users_email_key → ConflictError
 * "E-mail já cadastrado"). Os nomes de constraint estão em docs/modelo-de-dados.md.
 */

/** SQLSTATEs que a API trata (https://www.postgresql.org/docs/current/errcodes-appendix.html). */
export const PG_ERROR = {
  UNIQUE_VIOLATION: "23505",
  FOREIGN_KEY_VIOLATION: "23503",
  CHECK_VIOLATION: "23514",
  NOT_NULL_VIOLATION: "23502",
  EXCLUSION_VIOLATION: "23P01",
  INVALID_TEXT_REPRESENTATION: "22P02",
  SERIALIZATION_FAILURE: "40001",
  DEADLOCK_DETECTED: "40P01",
  LOCK_NOT_AVAILABLE: "55P03",
  QUERY_CANCELED: "57014",
  INSUFFICIENT_PRIVILEGE: "42501",
} as const;

export type PgErrorCode = (typeof PG_ERROR)[keyof typeof PG_ERROR];

export function isPgError(err: unknown): err is pg.DatabaseError {
  if (err instanceof pg.DatabaseError) return true;
  // Fallback por formato: outra cópia de pg-protocol no node_modules quebra o instanceof.
  if (!(err instanceof Error) || !("severity" in err)) return false;
  const code = (err as Error & { code?: unknown }).code;
  return typeof code === "string" && /^[0-9A-Z]{5}$/.test(code);
}

function matches(err: unknown, code: string, constraint?: string): err is pg.DatabaseError {
  if (!isPgError(err) || err.code !== code) return false;
  return constraint === undefined || err.constraint === constraint;
}

/** Violação de unique (inclui índices únicos parciais, pelo nome do índice). */
export const isUniqueViolation = (err: unknown, constraint?: string) =>
  matches(err, PG_ERROR.UNIQUE_VIOLATION, constraint);

/** FK: inserir apontando para algo inexistente OU apagar algo ainda referenciado. */
export const isForeignKeyViolation = (err: unknown, constraint?: string) =>
  matches(err, PG_ERROR.FOREIGN_KEY_VIOLATION, constraint);

export const isCheckViolation = (err: unknown, constraint?: string) =>
  matches(err, PG_ERROR.CHECK_VIOLATION, constraint);

export const isNotNullViolation = (err: unknown, column?: string) =>
  isPgError(err) &&
  err.code === PG_ERROR.NOT_NULL_VIOLATION &&
  (column === undefined || err.column === column);

/** Texto inválido para o tipo (ex.: id que não é uuid). Normalmente vira 400/404. */
export const isInvalidTextRepresentation = (err: unknown) =>
  matches(err, PG_ERROR.INVALID_TEXT_REPRESENTATION);

/** Erros em que repetir a transação inteira resolve (concorrência). */
export const isRetryableTransactionError = (err: unknown) =>
  isPgError(err) &&
  (err.code === PG_ERROR.SERIALIZATION_FAILURE || err.code === PG_ERROR.DEADLOCK_DETECTED);

/**
 * Banco sobrecarregado, não erro do pedido: pool sem conexão livre dentro do
 * prazo, consulta cancelada pelo statement_timeout ou espera de lock
 * estourada. Vale responder 503 com Retry-After (o cliente tenta de novo).
 */
export function isDatabaseOverloaded(err: unknown): boolean {
  if (err instanceof Error && /timeout exceeded when trying to connect/i.test(err.message)) {
    return true;
  }
  return (
    isPgError(err) &&
    (err.code === PG_ERROR.QUERY_CANCELED || err.code === PG_ERROR.LOCK_NOT_AVAILABLE)
  );
}

/** Erro de domínio para cada constraint conhecida (unique, FK, check), pelo nome dela. */
export type ConstraintErrors = Readonly<Record<string, () => Error>>;

/**
 * Roda a escrita e troca a violação de uma constraint conhecida pelo erro de
 * domínio dela (ex.: users_email_key → "E-mail já cadastrado"). Outros erros
 * sobem como vieram. Os nomes das constraints estão nas migrations.
 */
export async function translateConstraintErrors<T>(
  write: () => Promise<T>,
  errors: ConstraintErrors,
): Promise<T> {
  try {
    return await write();
  } catch (err) {
    const constraint = isPgError(err) ? err.constraint : undefined;
    const toDomain = constraint && Object.hasOwn(errors, constraint) ? errors[constraint] : null;
    throw toDomain ? toDomain() : err;
  }
}

/** Apagar algo que outra tabela ainda referencia (qualquer FK) → erro de domínio dado. */
export async function translateInUseError<T>(
  remove: () => Promise<T>,
  inUse: () => Error,
): Promise<T> {
  try {
    return await remove();
  } catch (err) {
    throw isForeignKeyViolation(err) ? inUse() : err;
  }
}

/** `one()` sem linha: a consulta deveria achar exatamente uma. */
export class NoRowsError extends Error {
  override readonly name = "NoRowsError";
  constructor(readonly query: string) {
    super("A consulta não retornou nenhuma linha (esperada exatamente uma).");
  }
}

/** `one()`/`maybeOne()` com mais de uma linha: a consulta está errada. */
export class TooManyRowsError extends Error {
  override readonly name = "TooManyRowsError";
  constructor(
    readonly query: string,
    readonly rowCount: number,
  ) {
    super(`A consulta retornou ${rowCount} linhas (esperada no máximo uma).`);
  }
}

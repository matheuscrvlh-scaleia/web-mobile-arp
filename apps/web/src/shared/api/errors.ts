import { apiErrorSchema, type ErrorCode } from "@arp/contracts";

/** Códigos que só existem no cliente (a API nunca os devolve). */
export type ClientErrorCode = "NETWORK_ERROR" | "BAD_RESPONSE";

/** Erros de campo do VALIDATION_ERROR: { campo: [mensagens] } (campo aninhado com ponto). */
export type FieldErrors = Record<string, string[]>;

/**
 * Erro de qualquer chamada à API, já normalizado. A tela decide o que
 * mostrar pelo `code`; `message` já vem em pt-BR do servidor.
 */
export class ApiError extends Error {
  override readonly name = "ApiError";

  constructor(
    readonly status: number,
    readonly code: ErrorCode | ClientErrorCode,
    message: string,
    readonly details?: unknown,
    readonly requestId?: string,
  ) {
    super(message);
  }

  get isValidation(): boolean {
    return this.code === "VALIDATION_ERROR";
  }

  /** Erros por campo (só em VALIDATION_ERROR com details no formato esperado). */
  get fieldErrors(): FieldErrors {
    return parseFieldErrors(this.details);
  }
}

function parseFieldErrors(details: unknown): FieldErrors {
  if (!details || typeof details !== "object" || Array.isArray(details)) return {};
  const out: FieldErrors = {};
  for (const [field, value] of Object.entries(details)) {
    if (Array.isArray(value)) {
      const msgs = value.filter((m): m is string => typeof m === "string");
      if (msgs.length > 0) out[field] = msgs;
    } else if (typeof value === "string") {
      out[field] = [value];
    }
  }
  return out;
}

const STATUS_MESSAGES: Record<number, string> = {
  401: "Sua sessão expirou. Entre de novo.",
  403: "Você não tem permissão para isso.",
  404: "Não encontrado.",
  413: "Arquivo grande demais.",
  429: "Muitas tentativas. Espere um pouco e tente de novo.",
};

/** Converte a resposta de erro (corpo do contrato ou não) em ApiError. */
export async function toApiError(res: Response): Promise<ApiError> {
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // Sem corpo JSON (proxy, gateway): fica a mensagem genérica pelo status.
  }
  const parsed = apiErrorSchema.safeParse(body);
  if (parsed.success) {
    const { code, message, details, requestId } = parsed.data.error;
    return new ApiError(res.status, code, message, details, requestId);
  }
  const message =
    STATUS_MESSAGES[res.status] ??
    (res.status >= 500
      ? "O servidor não respondeu como esperado. Tente de novo em instantes."
      : "Não deu para concluir. Tente de novo.");
  const code: ErrorCode =
    res.status === 401
      ? "UNAUTHENTICATED"
      : res.status === 403
        ? "FORBIDDEN"
        : res.status === 404
          ? "NOT_FOUND"
          : res.status === 429
            ? "RATE_LIMITED"
            : "INTERNAL_ERROR";
  return new ApiError(res.status, code, message);
}

/** Mensagem do toast quando um envio (POST/PATCH/DELETE) não sai por falta de rede. */
export const OFFLINE_SAVE_MESSAGE =
  "Sem conexão: nada foi salvo. Tente de novo quando a internet voltar.";

/** `write`: era um envio (nada foi salvo); senão, uma leitura. */
export const networkError = (write = false) =>
  new ApiError(
    0,
    "NETWORK_ERROR",
    write
      ? OFFLINE_SAVE_MESSAGE
      : "Sem conexão com o servidor. Confira a internet e tente de novo.",
  );

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError;

/** Erro de rede (sem internet ou servidor fora do ar)? */
export const isNetworkError = (e: unknown): boolean => isApiError(e) && e.code === "NETWORK_ERROR";

/** Mensagem amigável para qualquer erro (para toasts e estados de erro). */
export function errorMessage(e: unknown): string {
  if (isApiError(e)) {
    // Erro de campo que a tela não marcou: diz o quê, em vez de "Dados inválidos".
    const first = e.isValidation ? Object.values(e.fieldErrors)[0]?.[0] : undefined;
    if (first && /^(dados|valor) inválido/i.test(e.message))
      return `Confira o formulário: ${first}`;
    return e.message;
  }
  if (e instanceof Error && e.message) return e.message;
  return "Algo deu errado. Tente de novo.";
}

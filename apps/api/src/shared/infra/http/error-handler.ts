import type { ApiError, ErrorCode } from "@arp/contracts";
import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { hasZodFastifySchemaValidationErrors } from "fastify-type-provider-zod";
import { DomainError, type DomainErrorCode } from "../../domain/errors";
import {
  isDatabaseOverloaded,
  isForeignKeyViolation,
  isInvalidTextRepresentation,
  isUniqueViolation,
} from "../database/errors";

/** Os códigos do domínio e os do contrato precisam ser exatamente os mesmos. */
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
export const ERROR_CODES_MATCH: Same<DomainErrorCode, ErrorCode> = true;

interface Mapped {
  status: number;
  body: ApiError["error"];
}

const STATUS_CODE: Record<number, ErrorCode> = {
  400: "VALIDATION_ERROR",
  401: "UNAUTHENTICATED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  413: "PAYLOAD_TOO_LARGE",
  415: "UNSUPPORTED_MEDIA_TYPE",
  422: "BUSINESS_RULE",
  429: "RATE_LIMITED",
};

const STATUS_MESSAGE: Record<number, string> = {
  400: "Requisição inválida",
  401: "Faça login para continuar",
  403: "Você não tem permissão para esta ação",
  404: "Não encontrado",
  409: "Conflito com o estado atual",
  413: "Arquivo ou corpo grande demais",
  415: "Tipo de conteúdo não suportado",
  422: "Não foi possível concluir a operação",
  429: "Muitas tentativas. Aguarde um pouco e tente de novo.",
};

/** { "campo.sub": ["mensagem"] } a partir dos erros do Zod (instancePath "/campo/sub"). */
function fieldErrors(
  issues: { instancePath: string; message?: string }[],
  context: string | undefined,
): Record<string, string[]> {
  const details: Record<string, string[]> = {};
  for (const issue of issues) {
    const key = issue.instancePath.replace(/^\//, "").replaceAll("/", ".") || context || "_";
    const list = details[key] ?? [];
    list.push(issue.message ?? "Valor inválido");
    details[key] = list;
  }
  return details;
}

function map(error: unknown): Mapped | null {
  if (error instanceof DomainError) {
    return {
      status: error.status,
      body: {
        code: error.code,
        message: error.message,
        ...(error.details === undefined ? {} : { details: error.details }),
      },
    };
  }
  if (hasZodFastifySchemaValidationErrors(error)) {
    return {
      status: 400,
      body: {
        code: "VALIDATION_ERROR",
        message: "Dados inválidos",
        details: fieldErrors(error.validation, (error as FastifyError).validationContext),
      },
    };
  }
  // Rede de segurança: o normal é o repositório traduzir antes.
  if (isUniqueViolation(error)) {
    return { status: 409, body: { code: "CONFLICT", message: "Registro duplicado" } };
  }
  if (isForeignKeyViolation(error)) {
    return {
      status: 409,
      body: { code: "CONFLICT", message: "Registro em uso ou referência inexistente" },
    };
  }
  if (isInvalidTextRepresentation(error)) {
    return { status: 400, body: { code: "VALIDATION_ERROR", message: "Valor inválido" } };
  }
  const status = (error as Partial<FastifyError>).statusCode;
  if (typeof status === "number" && status >= 400 && status < 500) {
    const code = STATUS_CODE[status] ?? "VALIDATION_ERROR";
    return { status, body: { code, message: STATUS_MESSAGE[status] ?? "Requisição inválida" } };
  }
  return null;
}

export function errorHandler(error: unknown, request: FastifyRequest, reply: FastifyReply): void {
  if (isDatabaseOverloaded(error)) {
    // Sobrecarga momentânea: 503 + Retry-After em vez de 500 (cliente e balanceador sabem esperar).
    request.log.warn({ err: error }, "Banco sobrecarregado");
    reply
      .status(503)
      .header("retry-after", "2")
      .send({
        error: {
          code: "INTERNAL_ERROR",
          message: "Serviço ocupado. Tente de novo em instantes.",
          requestId: request.id,
        },
      } satisfies ApiError);
    return;
  }
  const mapped = map(error);
  if (mapped) {
    if (mapped.status === 429) reply.header("retry-after", reply.getHeader("retry-after") ?? "60");
    request.log.info({ code: mapped.body.code, status: mapped.status }, "Requisição recusada");
    reply.status(mapped.status).send({ error: { ...mapped.body, requestId: request.id } });
    return;
  }
  // Inesperado: log completo, resposta sem detalhes internos.
  request.log.error({ err: error }, "Erro inesperado");
  reply.status(500).send({
    error: {
      code: "INTERNAL_ERROR",
      message: "Erro interno. Tente de novo em instantes.",
      requestId: request.id,
    },
  } satisfies ApiError);
}

export function notFoundHandler(request: FastifyRequest, reply: FastifyReply): void {
  reply.status(404).send({
    error: { code: "NOT_FOUND", message: "Rota não encontrada", requestId: request.id },
  } satisfies ApiError);
}

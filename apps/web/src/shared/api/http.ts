import {
  API_PREFIX,
  path as fillPath,
  ROUTES,
  type RouteDef,
  type UploadResponse,
  uploadResponseSchema,
} from "@arp/contracts";
import type { z } from "zod";
import { ApiError, networkError, toApiError } from "./errors";
import { getAccessToken, refreshSession, sessionExpired } from "./session";

export type QueryValue = string | number | boolean | null | undefined;
export type Query = Record<string, QueryValue>;

export interface CallOptions {
  /** Valores dos :params do caminho (ex.: { id }). */
  params?: Record<string, string>;
  /** Query string; vazios (undefined, null, "") ficam de fora. */
  query?: Query;
  /** Corpo JSON (ou FormData, enviado como multipart). */
  body?: unknown;
  signal?: AbortSignal;
}

export function buildUrl(route: RouteDef, { params, query }: CallOptions = {}): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v === undefined || v === null || v === "") continue;
    qs.set(k, String(v));
  }
  const s = qs.toString();
  return `${API_PREFIX}${fillPath(route.path, params)}${s ? `?${s}` : ""}`;
}

async function send(route: RouteDef, opts: CallOptions, retried = false): Promise<Response> {
  const headers = new Headers({ Accept: "application/json" });
  const token = getAccessToken();
  if (token && !route.public) headers.set("Authorization", `Bearer ${token}`);

  let body: BodyInit | undefined;
  if (opts.body instanceof FormData) {
    body = opts.body;
  } else if (opts.body !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(opts.body);
  }

  let res: Response;
  try {
    res = await fetch(buildUrl(route, opts), {
      method: route.method,
      headers,
      body,
      credentials: "include",
      signal: opts.signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw networkError(route.method !== "GET");
  }

  // Token vencido: um refresh compartilhado e a mesma chamada de novo, uma vez.
  if (res.status === 401 && !route.public && !retried) {
    const session = await refreshSession();
    if (session) return send(route, opts, true);
    sessionExpired();
  }
  return res;
}

async function readJson(res: Response): Promise<unknown> {
  if (res.status === 204) return undefined;
  const text = await res.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(res.status, "BAD_RESPONSE", "A resposta do servidor não pôde ser lida.");
  }
}

/**
 * Chama a rota e valida a resposta com o schema do contrato. Resposta fora
 * do contrato é erro (aparece cedo, em vez de quebrar a tela adiante).
 */
export async function apiRequest<S extends z.ZodType>(
  route: RouteDef,
  schema: S,
  opts: CallOptions = {},
): Promise<z.output<S>> {
  const res = await send(route, opts);
  if (!res.ok) throw await toApiError(res);
  const data = await readJson(res);
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    console.error(`[api] ${route.method} ${route.path}: resposta fora do contrato`, parsed.error);
    throw new ApiError(
      res.status,
      "BAD_RESPONSE",
      "A resposta do servidor veio num formato inesperado.",
    );
  }
  return parsed.data;
}

/** Escrita que responde 204 sem corpo (DELETE, reorder, logout, change-password). */
export async function apiCall(route: RouteDef, opts: CallOptions = {}): Promise<void> {
  const res = await send(route, opts);
  if (!res.ok) throw await toApiError(res);
}

/** Envia uma imagem (multipart, campo "file") e devolve a URL pública. */
export function uploadImage(file: File, signal?: AbortSignal): Promise<UploadResponse> {
  const form = new FormData();
  form.append("file", file);
  return apiRequest(ROUTES.uploads, uploadResponseSchema, { body: form, signal });
}

import { createHash } from "node:crypto";
import { promisify } from "node:util";
import { brotliCompress, gzip, constants as zlibConstants } from "node:zlib";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

const brotli = promisify(brotliCompress);
const gzipAsync = promisify(gzip);

/** Configuração de cache HTTP por rota (route config `httpCache`). */
export interface RouteHttpCache {
  /**
   * Resposta igual para todo visitante sem login: com o pedido anônimo, sai
   * `public, max-age=N` (CDN/proxy e o app podem guardar). Com Authorization
   * continua `private, no-cache` (pode vir personalizada).
   */
  publicMaxAgeSeconds?: number;
}

declare module "fastify" {
  interface FastifyContextConfig {
    httpCache?: RouteHttpCache;
  }
}

export interface HttpCacheOptions {
  /** gzip/br em respostas JSON grandes. */
  compression: boolean;
  /** Abaixo disso não compensa comprimir. */
  compressMinBytes?: number;
}

/** ETag fraca do corpo (W/: a mesma vale com ou sem compressão). */
export function weakEtag(body: string | Buffer): string {
  return `W/"${createHash("sha1").update(body).digest("base64url").slice(0, 27)}"`;
}

/** If-None-Match contém a ETag (lista separada por vírgula ou "*"). */
export function etagMatches(header: string | undefined, etag: string): boolean {
  if (!header) return false;
  if (header.trim() === "*") return true;
  const bare = etag.replace(/^W\//, "");
  return header.split(",").some((candidate) => candidate.trim().replace(/^W\//, "") === bare);
}

type Encoding = "br" | "gzip";

/** Escolhe a codificação pelo Accept-Encoding (br > gzip; q=0 recusa). */
export function pickEncoding(header: string | undefined): Encoding | null {
  if (!header) return null;
  const accepted = new Map<string, number>();
  for (const part of header.split(",")) {
    const [name, ...params] = part.trim().toLowerCase().split(";");
    if (!name) continue;
    const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
    accepted.set(name, q ? Number(q.slice(2)) : 1);
  }
  const ok = (name: string) => (accepted.get(name) ?? accepted.get("*") ?? 0) > 0;
  if (ok("br")) return "br";
  if (ok("gzip")) return "gzip";
  return null;
}

function isJson(reply: FastifyReply): boolean {
  const type = reply.getHeader("content-type");
  return typeof type === "string" && type.startsWith("application/json");
}

function appendVary(reply: FastifyReply, value: string): void {
  const current = reply.getHeader("vary");
  const list = typeof current === "string" && current ? current.split(/\s*,\s*/) : [];
  if (!list.includes(value)) list.push(value);
  reply.header("vary", list.join(", "));
}

/**
 * Cache HTTP e compressão das respostas JSON:
 * - GET 200: ETag fraca + 304 quando o If-None-Match bate (o painel e o app
 *   revalidam sem baixar o corpo de novo);
 * - Cache-Control: `public, max-age` só em rota marcada e pedido anônimo;
 *   o resto `private, no-cache` (pode guardar, mas revalida sempre);
 * - gzip/br (br nível 4: bem mais rápido que o 11 padrão, quase o mesmo tamanho)
 *   quando o cliente aceita. Atrás do nginx o proxy pede sem Accept-Encoding e
 *   comprime ele mesmo.
 */
export function registerHttpCache(app: FastifyInstance, options: HttpCacheOptions): void {
  const minBytes = options.compressMinBytes ?? 1_024;

  app.addHook("onSend", async (request: FastifyRequest, reply: FastifyReply, payload: unknown) => {
    if (typeof payload !== "string" || !isJson(reply)) return payload;

    const body: string = payload;
    if (request.method === "GET" && reply.statusCode === 200) {
      const etag = weakEtag(body);
      reply.header("etag", etag);
      appendVary(reply, "Authorization");
      const config = request.routeOptions.config?.httpCache;
      const anonymous = !request.headers.authorization;
      if (!reply.hasHeader("cache-control")) {
        reply.header(
          "cache-control",
          config?.publicMaxAgeSeconds && anonymous
            ? `public, max-age=${config.publicMaxAgeSeconds}, stale-while-revalidate=${config.publicMaxAgeSeconds}`
            : "private, no-cache",
        );
      }
      if (etagMatches(request.headers["if-none-match"], etag)) {
        reply.code(304);
        reply.removeHeader("content-length");
        return "";
      }
    }

    if (!options.compression || Buffer.byteLength(body) < minBytes) return body;
    appendVary(reply, "Accept-Encoding");
    const encoding = pickEncoding(request.headers["accept-encoding"]);
    if (!encoding || reply.hasHeader("content-encoding")) return body;
    const compressed =
      encoding === "br"
        ? await brotli(body, {
            params: {
              [zlibConstants.BROTLI_PARAM_QUALITY]: 4,
              [zlibConstants.BROTLI_PARAM_MODE]: zlibConstants.BROTLI_MODE_TEXT,
              [zlibConstants.BROTLI_PARAM_SIZE_HINT]: Buffer.byteLength(body),
            },
          })
        : await gzipAsync(body, { level: 6 });
    reply.header("content-encoding", encoding);
    reply.removeHeader("content-length");
    return compressed;
  });
}

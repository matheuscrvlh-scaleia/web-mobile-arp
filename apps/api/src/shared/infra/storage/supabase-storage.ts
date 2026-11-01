import { UPLOAD_MAX_BYTES, UPLOAD_MIME_TYPES } from "@arp/contracts";
import { StorageApiError, StorageClient } from "@supabase/storage-js";
import {
  assertValidStorageKey,
  type PutOptions,
  type Storage,
  type StoredObject,
} from "../../application/ports/storage";

export interface SupabaseStorageOptions {
  /** https://<projeto>.supabase.co */
  url: string;
  /** Service role key: só no servidor (ignora as políticas do Storage). */
  serviceRoleKey: string;
  bucket?: string;
}

/** Erro do Storage com o contexto da operação (o original fica em cause). */
export class StorageOperationError extends Error {
  override readonly name = "StorageOperationError";
}

/**
 * Supabase Storage usado só como armazenamento: bucket público "media",
 * gravado apenas pela API. O banco guarda a URL pública devolvida.
 */
export class SupabaseStorage implements Storage {
  private readonly client: StorageClient;
  private readonly bucket: string;
  private readonly publicPrefix: string;

  constructor(options: SupabaseStorageOptions) {
    const base = options.url.replace(/\/+$/, "");
    this.bucket = options.bucket ?? "media";
    this.client = new StorageClient(`${base}/storage/v1`, {
      apikey: options.serviceRoleKey,
      Authorization: `Bearer ${options.serviceRoleKey}`,
    });
    this.publicPrefix = `${base}/storage/v1/object/public/${this.bucket}/`;
  }

  /**
   * Cria o bucket público se não existir (idempotente; chamar na subida).
   * Bucket existente e privado é erro de configuração: as URLs públicas
   * gravadas no banco não abririam, então falha alto em vez de corrigir sozinho.
   */
  async ensureBucket(): Promise<void> {
    const { data, error } = await this.client.getBucket(this.bucket);
    if (data) {
      if (!data.public) {
        throw new StorageOperationError(
          `O bucket "${this.bucket}" existe mas não é público. Torne-o público no painel do Supabase.`,
        );
      }
      return;
    }
    if (error && !isNotFound(error)) {
      throw new StorageOperationError(`Falha ao consultar o bucket "${this.bucket}"`, {
        cause: error,
      });
    }

    const created = await this.client.createBucket(this.bucket, {
      public: true,
      fileSizeLimit: UPLOAD_MAX_BYTES,
      allowedMimeTypes: [...UPLOAD_MIME_TYPES],
    });
    // Outra réplica pode ter criado no meio do caminho.
    if (created.error && !isAlreadyExists(created.error)) {
      throw new StorageOperationError(`Falha ao criar o bucket "${this.bucket}"`, {
        cause: created.error,
      });
    }
  }

  async put(
    key: string,
    body: Uint8Array,
    contentType: string,
    options: PutOptions = {},
  ): Promise<StoredObject> {
    assertValidStorageKey(key);
    const { error } = await this.client.from(this.bucket).upload(key, body, {
      contentType,
      upsert: true,
      cacheControl: String(options.cacheControlSeconds ?? 31_536_000),
    });
    if (error) throw new StorageOperationError(`Falha ao enviar ${key}`, { cause: error });
    return { key, url: this.publicUrl(key) };
  }

  async remove(key: string): Promise<void> {
    assertValidStorageKey(key);
    const { error } = await this.client.from(this.bucket).remove([key]);
    if (error && !isNotFound(error)) {
      throw new StorageOperationError(`Falha ao apagar ${key}`, { cause: error });
    }
  }

  async exists(key: string): Promise<boolean> {
    assertValidStorageKey(key);
    const { data, error } = await this.client.from(this.bucket).exists(key);
    // HEAD não tem corpo: para objeto ausente o Storage responde 400, não 404
    // (a chave já foi validada acima, então o 400 só pode ser isso).
    if (error && !isNotFound(error) && !isBadRequest(error)) {
      throw new StorageOperationError(`Falha ao consultar ${key}`, { cause: error });
    }
    return data;
  }

  async get(key: string): Promise<Uint8Array | null> {
    assertValidStorageKey(key);
    const { data, error } = await this.client.from(this.bucket).download(key);
    if (error) {
      if (isNotFound(error)) return null;
      throw new StorageOperationError(`Falha ao baixar ${key}`, { cause: error });
    }
    return new Uint8Array(await data.arrayBuffer());
  }

  publicUrl(key: string): string {
    assertValidStorageKey(key);
    return this.publicPrefix + key;
  }

  keyFromUrl(url: string): string | null {
    if (!url.startsWith(this.publicPrefix)) return null;
    const key = decodeURIComponent(url.slice(this.publicPrefix.length).split("?")[0] ?? "");
    try {
      assertValidStorageKey(key);
      return key;
    } catch {
      return null;
    }
  }
}

function isNotFound(error: unknown): boolean {
  if (error instanceof StorageApiError) {
    return error.status === 404 || error.statusCode === "404" || error.code === "NoSuchKey";
  }
  return /not found/i.test(String((error as { message?: unknown })?.message ?? ""));
}

function isBadRequest(error: unknown): boolean {
  return error instanceof StorageApiError && (error.status === 400 || error.statusCode === "400");
}

function isAlreadyExists(error: unknown): boolean {
  if (error instanceof StorageApiError) {
    return error.status === 409 || error.code === "ResourceAlreadyExists";
  }
  return /already exists/i.test(String((error as { message?: unknown })?.message ?? ""));
}

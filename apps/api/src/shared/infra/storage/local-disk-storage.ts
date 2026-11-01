import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  assertValidStorageKey,
  type PutOptions,
  type Storage,
  type StoredObject,
} from "../../application/ports/storage";

/**
 * Storage em disco para dev offline. Os arquivos ficam em `rootDir` e a API
 * os serve em `publicPath` (padrão /uploads), atrás do mesmo proxy do web.
 */
export class LocalDiskStorage implements Storage {
  private readonly rootDir: string;
  private readonly publicPath: string;

  constructor(options: { rootDir: string; publicPath?: string }) {
    this.rootDir = path.resolve(options.rootDir);
    this.publicPath = (options.publicPath ?? "/uploads").replace(/\/+$/, "");
  }

  /** Diretório absoluto servido em publicPath (para o plugin de estáticos da API). */
  get directory(): string {
    return this.rootDir;
  }

  async put(
    key: string,
    body: Uint8Array,
    _contentType: string,
    _options?: PutOptions,
  ): Promise<StoredObject> {
    const file = this.resolve(key);
    await mkdir(path.dirname(file), { recursive: true });
    // Grava num temporário e renomeia: quem lê nunca vê arquivo pela metade.
    const tmp = `${file}.${randomUUID()}.tmp`;
    try {
      await writeFile(tmp, body);
      await rename(tmp, file);
    } catch (err) {
      await rm(tmp, { force: true });
      throw err;
    }
    return { key, url: this.publicUrl(key) };
  }

  async remove(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }

  async exists(key: string): Promise<boolean> {
    try {
      return (await stat(this.resolve(key))).isFile();
    } catch {
      return false;
    }
  }

  async get(key: string): Promise<Uint8Array | null> {
    try {
      return await readFile(this.resolve(key));
    } catch (err) {
      if ((err as { code?: string }).code === "ENOENT") return null;
      throw err;
    }
  }

  publicUrl(key: string): string {
    assertValidStorageKey(key);
    return `${this.publicPath}/${key}`;
  }

  keyFromUrl(url: string): string | null {
    const prefix = `${this.publicPath}/`;
    if (!url.startsWith(prefix)) return null;
    const key = url.slice(prefix.length);
    try {
      assertValidStorageKey(key);
      return key;
    } catch {
      return null;
    }
  }

  /** Caminho no disco, garantindo que não escapa do diretório raiz. */
  private resolve(key: string): string {
    assertValidStorageKey(key);
    const file = path.resolve(this.rootDir, ...key.split("/"));
    if (!file.startsWith(this.rootDir + path.sep)) {
      throw new Error(`Chave de storage fora do diretório: ${key}`);
    }
    return file;
  }
}

import type { Storage } from "../../application/ports/storage";
import type { StorageEnv } from "../infra-env";
import { LocalDiskStorage } from "./local-disk-storage";

export { LocalDiskStorage } from "./local-disk-storage";

/**
 * Imagens e arquivos ficam no disco do servidor (o volume "uploads" da VPS) e
 * a própria API os serve em STORAGE_LOCAL_PUBLIC_PATH. Nada vai para o Supabase.
 * Chamar uma vez na subida (composition root).
 */
export async function createStorage(env: StorageEnv): Promise<Storage> {
  return new LocalDiskStorage({
    rootDir: env.STORAGE_LOCAL_DIR,
    publicPath: env.STORAGE_LOCAL_PUBLIC_PATH,
    publicBaseUrl: env.STORAGE_PUBLIC_BASE_URL,
  });
}

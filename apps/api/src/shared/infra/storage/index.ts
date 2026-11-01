import type { Storage } from "../../application/ports/storage";
import type { StorageEnv } from "../infra-env";
import { LocalDiskStorage } from "./local-disk-storage";
import { SupabaseStorage } from "./supabase-storage";

export { LocalDiskStorage } from "./local-disk-storage";
export { StorageOperationError, SupabaseStorage } from "./supabase-storage";

/**
 * Escolhe o adaptador por STORAGE_DRIVER e prepara o destino (cria o bucket
 * no Supabase / a pasta local). Chamar uma vez na subida (composition root).
 */
export async function createStorage(env: StorageEnv): Promise<Storage> {
  if (env.STORAGE_DRIVER === "supabase") {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("STORAGE_DRIVER=supabase exige SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY");
    }
    const storage = new SupabaseStorage({
      url: env.SUPABASE_URL,
      serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
      bucket: env.SUPABASE_STORAGE_BUCKET,
    });
    await storage.ensureBucket();
    return storage;
  }
  return new LocalDiskStorage({
    rootDir: env.STORAGE_LOCAL_DIR,
    publicPath: env.STORAGE_LOCAL_PUBLIC_PATH,
  });
}

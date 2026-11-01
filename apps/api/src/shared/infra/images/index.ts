import { type ImageCleanup, StorageImageCleanup } from "../../application/image-variants";
import type { CoreDeps } from "../core";
import { PgImageReferences } from "./pg-image-references";

export { IMAGE_URL_COLUMNS, listImageUrls, PgImageReferences } from "./pg-image-references";
export { IMAGE_MAX_INPUT_PIXELS, SharpImageProcessor } from "./sharp-image-processor";

/** Limpeza de imagens trocadas/apagadas para os módulos (falha só vira log). */
export function createImageCleanup(
  core: Pick<CoreDeps, "db" | "storage" | "logger">,
): ImageCleanup {
  return new StorageImageCleanup({
    storage: core.storage,
    references: new PgImageReferences(core.db),
    onError: (err, url) => core.logger.warn({ err, url }, "Falha ao apagar imagem antiga"),
  });
}

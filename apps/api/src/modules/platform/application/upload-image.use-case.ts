import type { StaffActor } from "../../../shared/application/actor";
import { IMAGE_CACHE_SECONDS, ImageVariants } from "../../../shared/application/image-variants";
import type { AuditLogger } from "../../../shared/application/ports/audit-logger";
import type { Clock } from "../../../shared/application/ports/clock";
import { type ImageProcessor, InvalidImageError } from "../../../shared/application/ports/images";
import { buildMediaKey, type Storage } from "../../../shared/application/ports/storage";
import type { ImageMimeType } from "../domain/image-type";
import { assertValidImage, UnsupportedMediaTypeError, type UploadFolder } from "../domain/upload";

export interface UploadImageDeps {
  storage: Storage;
  images: ImageProcessor;
  audit: AuditLogger;
  clock: Clock;
  maxBytes: number;
}

export interface UploadImageInput {
  bytes: Uint8Array;
  declaredMimeType: string;
  folder: UploadFolder;
}

export interface UploadedImage {
  url: string;
  mimeType: ImageMimeType;
  size: number;
}

/**
 * Guarda uma imagem no storage com as miniaturas (IMAGE_WIDTHS, WebP) e
 * devolve a URL pública da original. Só responde depois de tudo gravado:
 * quem recebe a URL pode pedir qualquer miniatura (imageVariantUrl).
 */
export class UploadImageUseCase {
  private readonly variants: ImageVariants;

  constructor(private readonly deps: UploadImageDeps) {
    this.variants = new ImageVariants({ storage: deps.storage, processor: deps.images });
  }

  async execute(input: UploadImageInput, actor: StaffActor): Promise<UploadedImage> {
    const { storage, audit, clock, maxBytes } = this.deps;
    const mimeType = assertValidImage(input.bytes, input.declaredMimeType, maxBytes);
    const key = buildMediaKey(input.folder, mimeType, clock.now());
    // Gera antes de gravar: assinatura certa mas conteúdo ilegível é recusado sem sobrar arquivo.
    const variants = await this.variants.generate(key, input.bytes).catch((err: unknown) => {
      if (!(err instanceof InvalidImageError)) throw err;
      throw new UnsupportedMediaTypeError(
        err.reason === "too-many-pixels"
          ? "A imagem tem resolução grande demais"
          : "Não foi possível ler a imagem (arquivo corrompido?)",
      );
    });
    // Storage não é transacional: grava antes e audita depois (arquivo órfão é inofensivo).
    const [stored] = await Promise.all([
      storage.put(key, input.bytes, mimeType, { cacheControlSeconds: IMAGE_CACHE_SECONDS }),
      this.variants.put(variants),
    ]);
    const result = { url: stored.url, mimeType, size: input.bytes.length };
    await audit.log({
      actor,
      action: "upload.create",
      entityType: "upload",
      entityId: key,
      changes: result,
    });
    return result;
  }
}

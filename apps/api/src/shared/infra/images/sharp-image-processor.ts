import sharp from "sharp";
import {
  type ImageProcessor,
  type ImageVariant,
  InvalidImageError,
} from "../../application/ports/images";

// Cada imagem é processada uma vez: o cache de operações do libvips só gastaria memória.
sharp.cache(false);

/**
 * Teto de pixels decodificados (40 MP ≈ 7300×5500). O upload já limita 5 MB,
 * mas um PNG pequeno pode declarar dimensões enormes (bomba de descompressão).
 */
export const IMAGE_MAX_INPUT_PIXELS = 40_000_000;

export interface SharpImageProcessorOptions {
  maxInputPixels?: number;
  /** Qualidade WebP (1–100). */
  quality?: number;
}

/** Miniaturas WebP com sharp (libvips; binário pré-compilado, inclusive musl/Alpine). */
export class SharpImageProcessor implements ImageProcessor {
  private readonly maxInputPixels: number;
  private readonly quality: number;

  constructor(options: SharpImageProcessorOptions = {}) {
    this.maxInputPixels = options.maxInputPixels ?? IMAGE_MAX_INPUT_PIXELS;
    this.quality = options.quality ?? 80;
  }

  async webpVariants(bytes: Uint8Array, widths: readonly number[]): Promise<ImageVariant[]> {
    try {
      const input = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const open = () => sharp(input, { limitInputPixels: this.maxInputPixels });
      const meta = await open().metadata();
      if (meta.width * meta.height > this.maxInputPixels) {
        throw new InvalidImageError("too-many-pixels");
      }
      // Largura final já orientada (foto de celular "em pé" vem deitada com EXIF).
      const sourceWidth = meta.autoOrient.width;

      // Imagem menor que as larguras pedidas: várias saem iguais, codifica uma vez só.
      const encoded = new Map<number, Promise<Buffer>>();
      const encode = (target: number) => {
        let job = encoded.get(target);
        if (!job) {
          job = open()
            .autoOrient()
            .resize({ width: target, withoutEnlargement: true })
            .webp({ quality: this.quality })
            .toBuffer();
          encoded.set(target, job);
        }
        return job;
      };
      return await Promise.all(
        widths.map(async (width) => ({
          width,
          body: await encode(Math.min(width, sourceWidth)),
        })),
      );
    } catch (err) {
      if (err instanceof InvalidImageError) throw err;
      const tooBig = /pixel limit/i.test(String((err as Error)?.message));
      throw new InvalidImageError(tooBig ? "too-many-pixels" : "unreadable", { cause: err });
    }
  }
}

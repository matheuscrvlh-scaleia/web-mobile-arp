/** Gera as miniaturas das imagens. Implementação: SharpImageProcessor. */
export interface ImageProcessor {
  /**
   * Uma WebP por largura pedida: largura máxima sem ampliar imagem menor,
   * orientação do EXIF aplicada e metadados removidos. Imagem ilegível ou
   * com pixels demais → InvalidImageError.
   */
  webpVariants(bytes: Uint8Array, widths: readonly number[]): Promise<ImageVariant[]>;
}

export interface ImageVariant {
  /** Largura pedida (vai no nome do arquivo), não a final da imagem. */
  width: number;
  body: Uint8Array;
}

export class InvalidImageError extends Error {
  override readonly name = "InvalidImageError";
  constructor(
    readonly reason: "unreadable" | "too-many-pixels",
    options?: ErrorOptions,
  ) {
    super(reason === "too-many-pixels" ? "Imagem com pixels demais" : "Imagem ilegível", options);
  }
}

/** Diz se alguma linha do banco ainda usa a URL (antes de apagar o arquivo). */
export interface ImageReferences {
  isReferenced(url: string): Promise<boolean>;
}

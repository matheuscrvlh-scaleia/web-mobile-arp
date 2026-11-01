import { DomainError, ValidationError } from "../../../shared/domain/errors";
import { detectImageType, type ImageMimeType } from "./image-type";

/** Pastas permitidas no storage (a primeira parte da chave). */
export const UPLOAD_FOLDERS = [
  "stores",
  "coupons",
  "events",
  "highlights",
  "seals",
  "floors",
  "misc",
] as const;
export type UploadFolder = (typeof UPLOAD_FOLDERS)[number];

export const ALLOWED_IMAGE_TYPES: readonly ImageMimeType[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

export class PayloadTooLargeError extends DomainError {
  override readonly name = "PayloadTooLargeError";
  constructor(maxBytes: number) {
    const mb = (maxBytes / (1024 * 1024)).toFixed(maxBytes % (1024 * 1024) === 0 ? 0 : 1);
    super("PAYLOAD_TOO_LARGE", `A imagem passa do limite de ${mb} MB`, 413);
  }
}

export class UnsupportedMediaTypeError extends DomainError {
  override readonly name = "UnsupportedMediaTypeError";
  constructor(message = "Envie uma imagem JPEG, PNG ou WebP") {
    super("UNSUPPORTED_MEDIA_TYPE", message, 415);
  }
}

export function isUploadFolder(value: string): value is UploadFolder {
  return (UPLOAD_FOLDERS as readonly string[]).includes(value);
}

/**
 * Valida o arquivo enviado: não vazio, dentro do limite, tipo declarado
 * permitido e igual ao tipo real detectado pelos bytes.
 */
export function assertValidImage(
  bytes: Uint8Array,
  declaredMimeType: string,
  maxBytes: number,
): ImageMimeType {
  if (bytes.length === 0) throw ValidationError.field("file", "O arquivo está vazio");
  if (bytes.length > maxBytes) throw new PayloadTooLargeError(maxBytes);
  const declared = declaredMimeType.toLowerCase();
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(declared)) {
    throw new UnsupportedMediaTypeError();
  }
  const detected = detectImageType(bytes);
  if (detected === null || detected !== declared) {
    throw new UnsupportedMediaTypeError(
      "O conteúdo do arquivo não corresponde a uma imagem válida",
    );
  }
  return detected;
}

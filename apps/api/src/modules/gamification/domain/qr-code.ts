import { createHmac, timingSafeEqual } from "node:crypto";
import { ValidationError } from "../../../shared/domain/errors";
import { applyPatch } from "../../../shared/domain/patch";

export type QrCodeStatus = "active" | "revoked";

export interface QrCodeProps {
  id: string;
  challengeId: string;
  token: string;
  label: string;
  validFrom: Date | null;
  /** Fixo: criação + prazo. Telão: null (o prazo é de cada janela). */
  validUntil: Date | null;
  status: QrCodeStatus;
  /** Prazo de cada código (s). Todo QR tem prazo (Fase 2). */
  ttlSeconds: number;
  /** Modo telão: o código muda a cada ttlSeconds e o anterior deixa de valer. */
  rotating: boolean;
  /** Segredo do HMAC das janelas do telão (null no fixo). Nunca sai da API. */
  rotationSecret: string | null;
  createdBy: string | null;
}

export type NewQrCode = Omit<QrCodeProps, "id">;
export type QrCodeChanges = Partial<Pick<QrCodeProps, "label" | "status" | "validFrom">>;

export const QR_PAYLOAD_PREFIX = "arp://selo/";
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{24,128}$/;
const SIG_LENGTH = 12;
/** Tolerância para o código que acabou de trocar no telão (leitura em andamento). */
const ROTATION_GRACE_MS = 3000;

export interface QrPayload {
  token: string;
  /** Janela do telão (null no QR fixo). */
  window: number | null;
  sig: string | null;
}

/**
 * Texto do QR → token (e janela assinada, no telão: `<token>.<janela>.<assinatura>`).
 * Aceita o payload completo ou só o token; formato estranho → null.
 */
export function parseQrPayload(text: string): QrPayload | null {
  const trimmed = text.trim();
  const body = trimmed.startsWith(QR_PAYLOAD_PREFIX)
    ? trimmed.slice(QR_PAYLOAD_PREFIX.length)
    : trimmed;
  const [token = "", window, sig, ...rest] = body.split(".");
  if (!TOKEN_PATTERN.test(token) || rest.length > 0) return null;
  if (window === undefined) return { token, window: null, sig: null };
  if (!/^\d{1,12}$/.test(window) || !sig || !/^[A-Za-z0-9_-]+$/.test(sig)) return null;
  return { token, window: Number(window), sig };
}

export function qrPayload(token: string): string {
  return `${QR_PAYLOAD_PREFIX}${token}`;
}

/** Janela do telão em que `at` cai. */
export function rotationWindow(at: Date, ttlSeconds: number): number {
  return Math.floor(at.getTime() / (ttlSeconds * 1000));
}

function signWindow(secret: string, token: string, window: number): string {
  return createHmac("sha256", secret)
    .update(`${token}.${window}`)
    .digest("base64url")
    .slice(0, SIG_LENGTH);
}

/** QR Code de um desafio, sempre com prazo. */
export class QrCode {
  private constructor(private props: QrCodeProps) {}

  static restore(props: QrCodeProps): QrCode {
    return new QrCode({ ...props });
  }

  static assertValidTtl(ttlSeconds: number): void {
    if (!Number.isInteger(ttlSeconds) || ttlSeconds < 15) {
      throw ValidationError.field("ttlSeconds", "Escolha o prazo do QR Code");
    }
  }

  get id(): string {
    return this.props.id;
  }
  get challengeId(): string {
    return this.props.challengeId;
  }
  get isActive(): boolean {
    return this.props.status === "active";
  }
  get rotating(): boolean {
    return this.props.rotating;
  }

  /**
   * Código válido agora? Fixo: dentro de [validFrom, validUntil). Telão: a
   * janela lida é a atual (ou a anterior há menos de 3 s) e a assinatura confere.
   */
  accepts(payload: QrPayload, now: Date): boolean {
    const { validFrom, validUntil, rotating, rotationSecret, ttlSeconds, token } = this.props;
    if (validFrom && now < validFrom) return false;
    if (!rotating) return payload.window === null && validUntil !== null && now < validUntil;
    if (payload.window === null || !payload.sig || !rotationSecret) return false;
    const current = rotationWindow(now, ttlSeconds);
    const previousStillOk =
      payload.window === current - 1 &&
      now.getTime() - current * ttlSeconds * 1000 < ROTATION_GRACE_MS;
    if (payload.window !== current && !previousStillOk) return false;
    const expected = Buffer.from(signWindow(rotationSecret, token, payload.window));
    const got = Buffer.from(payload.sig);
    return expected.length === got.length && timingSafeEqual(expected, got);
  }

  /** O que mostrar agora (telão: código da janela atual, que vence no fim dela). */
  current(now: Date): { payload: string; expiresAt: Date } {
    const { token, rotating, rotationSecret, ttlSeconds, validUntil } = this.props;
    if (!rotating || !rotationSecret) {
      return { payload: qrPayload(token), expiresAt: validUntil ?? now };
    }
    const window = rotationWindow(now, ttlSeconds);
    return {
      payload: `${qrPayload(token)}.${window}.${signWindow(rotationSecret, token, window)}`,
      expiresAt: new Date((window + 1) * ttlSeconds * 1000),
    };
  }

  update(changes: QrCodeChanges): void {
    this.props = applyPatch(this.props, changes);
  }

  toState(): QrCodeProps {
    return { ...this.props };
  }
}

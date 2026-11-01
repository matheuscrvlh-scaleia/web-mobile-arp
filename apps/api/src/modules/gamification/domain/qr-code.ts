import { ValidationError } from "../../../shared/domain/errors";
import { applyPatch } from "../../../shared/domain/patch";

export type QrCodeStatus = "active" | "revoked";

export interface QrCodeProps {
  id: string;
  challengeId: string;
  token: string;
  label: string;
  validFrom: Date | null;
  validUntil: Date | null;
  status: QrCodeStatus;
}

export type NewQrCode = Omit<QrCodeProps, "id">;
export type QrCodeChanges = Partial<
  Pick<QrCodeProps, "label" | "status" | "validFrom" | "validUntil">
>;

export const QR_PAYLOAD_PREFIX = "arp://selo/";
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{24,128}$/;

/** Texto do QR → token. Aceita o payload completo ou só o token; formato estranho → null. */
export function parseQrPayload(text: string): string | null {
  const trimmed = text.trim();
  const token = trimmed.startsWith(QR_PAYLOAD_PREFIX)
    ? trimmed.slice(QR_PAYLOAD_PREFIX.length)
    : trimmed;
  return TOKEN_PATTERN.test(token) ? token : null;
}

export function qrPayload(token: string): string {
  return `${QR_PAYLOAD_PREFIX}${token}`;
}

/** QR Code de um desafio, com janela de validade própria (opcional). */
export class QrCode {
  private constructor(private props: QrCodeProps) {}

  static restore(props: QrCodeProps): QrCode {
    return new QrCode({ ...props });
  }

  static assertValidWindow(validFrom: Date | null, validUntil: Date | null): void {
    if (validFrom && validUntil && validUntil <= validFrom) {
      throw ValidationError.field("validUntil", "O fim precisa ser depois do início");
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

  /** Dentro da janela própria do QR (além do período da campanha). */
  isWithinWindow(now: Date): boolean {
    const { validFrom, validUntil } = this.props;
    return (!validFrom || validFrom <= now) && (!validUntil || now < validUntil);
  }

  update(changes: QrCodeChanges): void {
    const next = applyPatch(this.props, changes);
    QrCode.assertValidWindow(next.validFrom, next.validUntil);
    this.props = next;
  }

  toState(): QrCodeProps {
    return { ...this.props };
  }
}

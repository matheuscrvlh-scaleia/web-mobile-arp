import type { QrCode } from "@arp/contracts";
import { formatDateTime } from "@/shared/lib/format";

export type QrState = "active" | "scheduled" | "expired" | "revoked";

/** Situação do QR agora: revogado, ainda não começou, venceu ou valendo. */
export function qrState(qr: QrCode, now = Date.now()): QrState {
  if (qr.status === "revoked") return "revoked";
  if (qr.validFrom && new Date(qr.validFrom).getTime() > now) return "scheduled";
  if (qr.validUntil && new Date(qr.validUntil).getTime() <= now) return "expired";
  return "active";
}

/** Janela de validade em texto. Sem janela, vale enquanto a campanha está no ar. */
export function qrWindowText(qr: Pick<QrCode, "validFrom" | "validUntil">): string {
  const { validFrom, validUntil } = qr;
  if (validFrom && validUntil)
    return `De ${formatDateTime(validFrom)} até ${formatDateTime(validUntil)}`;
  if (validFrom) return `A partir de ${formatDateTime(validFrom)}`;
  if (validUntil) return `Até ${formatDateTime(validUntil)}`;
  return "Sempre (enquanto a campanha estiver no ar)";
}

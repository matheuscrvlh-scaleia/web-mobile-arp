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

const TTL_TEXT: Record<number, string> = {
  45: "45 segundos",
  300: "5 minutos",
  3600: "1 hora",
  86400: "24 horas",
};

/** Prazo em texto ("5 minutos"). */
export function ttlText(seconds: number): string {
  return TTL_TEXT[seconds] ?? `${Math.round(seconds / 60)} min`;
}

/** Validade em texto. Telão: o código muda a cada prazo. */
export function qrWindowText(
  qr: Pick<QrCode, "validFrom" | "validUntil" | "rotating" | "ttlSeconds">,
): string {
  const { validFrom, validUntil } = qr;
  if (qr.rotating) {
    const every = `Telão: muda a cada ${ttlText(qr.ttlSeconds)}`;
    return validFrom ? `${every}, a partir de ${formatDateTime(validFrom)}` : every;
  }
  if (validFrom && validUntil)
    return `De ${formatDateTime(validFrom)} até ${formatDateTime(validUntil)}`;
  if (validFrom) return `A partir de ${formatDateTime(validFrom)}`;
  if (validUntil) return `Até ${formatDateTime(validUntil)}`;
  return "Sempre (enquanto a campanha estiver no ar)";
}

export type ClaimStatus = "active" | "redeemed" | "expired" | "cancelled";
export type WalletStatus = "active" | "used" | "expired" | "cancelled";

/**
 * Como o visitante vê o cupom pego. Ativo com prazo vencido já é "expirado"
 * (a unidade voltou para a promoção), mesmo antes de o job gravar o status.
 */
export function walletStatusOf(status: ClaimStatus, expiresAt: Date, now: Date): WalletStatus {
  switch (status) {
    case "redeemed":
      return "used";
    case "cancelled":
      return "cancelled";
    case "expired":
      return "expired";
    case "active":
      return expiresAt > now ? "active" : "expired";
  }
}

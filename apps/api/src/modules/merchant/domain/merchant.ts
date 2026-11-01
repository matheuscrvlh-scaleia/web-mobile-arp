/** Permissão que abre o painel do lojista no app (validar código no caixa). */
export const MERCHANT_APP_PERMISSION = "coupons.redeem";

export type MerchantAccountStatus = "active" | "disabled";

/**
 * Usuário do painel visto pelo app do lojista: credencial, situação e o que
 * vai no access token (cargo, permissões e loja atuais).
 */
export interface MerchantAccount {
  id: string;
  name: string;
  passwordHash: string;
  status: MerchantAccountStatus;
  roleId: string;
  permissions: string[];
  /** null = sem loja (administrador, atendimento): age em qualquer loja ativa. */
  storeId: string | null;
}

export function canUseMerchantApp(account: Pick<MerchantAccount, "permissions">): boolean {
  return account.permissions.includes(MERCHANT_APP_PERMISSION);
}

/** Só o primeiro nome do visitante vai para o caixa. */
export function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] ?? "";
}

/**
 * Código já usado, mascarado para a lista de "últimos usos" (o lojista
 * reconhece pelo final; a lista não serve de catálogo de códigos).
 */
export function maskClaimCode(code: string): string {
  const [prefix, body = ""] = code.split("-");
  if (!body) return "***";
  return `${prefix}-${"*".repeat(Math.max(0, body.length - 3))}${body.slice(-3)}`;
}

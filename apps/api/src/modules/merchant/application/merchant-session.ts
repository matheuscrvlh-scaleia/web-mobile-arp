import type { TokenService } from "../../../shared/application/ports/token-service";
import { type SessionService, signStaffToken } from "../../identity";
import type { MerchantAccount } from "../domain/merchant";
import type { MerchantScope } from "./merchant-scope";

/**
 * Sessões do lojista no app: audiência "admin", a mesma do painel. O access
 * token é idêntico ao do painel (as rotas do painel e o RBAC valem igual) e
 * desativar o usuário, trocar ou resetar a senha derruba também o app.
 */
export type MerchantSessions = Pick<SessionService, "start" | "rotate" | "end" | "endAllFor">;

export const MERCHANT_SESSION_AUDIENCE = "admin" as const;

export interface MerchantSessionResult extends MerchantScope {
  userId: string;
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  refreshExpiresAt: Date;
}

export async function merchantSession(
  tokens: TokenService,
  account: MerchantAccount,
  scope: MerchantScope,
  refresh: { refreshToken: string; expiresAt: Date; familyId: string },
): Promise<MerchantSessionResult> {
  const access = await signStaffToken(tokens, account, refresh.familyId);
  return {
    userId: account.id,
    accessToken: access.token,
    expiresIn: access.expiresIn,
    refreshToken: refresh.refreshToken,
    refreshExpiresAt: refresh.expiresAt,
    ...scope,
  };
}

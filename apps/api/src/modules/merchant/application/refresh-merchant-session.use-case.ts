import type { RequestOrigin } from "../../../shared/application/actor";
import type { TokenService } from "../../../shared/application/ports/token-service";
import { UnauthenticatedError } from "../../../shared/domain/errors";
import type { MerchantAccountRepository } from "../domain/repositories";
import { type MerchantScope, type MerchantStoreReader, merchantScopeOf } from "./merchant-scope";
import {
  MERCHANT_SESSION_AUDIENCE,
  type MerchantSessionResult,
  type MerchantSessions,
  merchantSession,
} from "./merchant-session";

export interface RefreshMerchantSessionDeps {
  accounts: MerchantAccountRepository;
  stores: MerchantStoreReader;
  sessions: MerchantSessions;
  tokens: TokenService;
}

const SESSION_ENDED = "Sua sessão terminou. Entre de novo.";

/**
 * Renova a sessão do lojista (refresh no corpo, rotativo). O novo access
 * token traz cargo, permissões e loja atuais. Usuário desativado → derruba
 * todos os logins dele (como no painel); perdeu `coupons.redeem` ou a loja →
 * encerra só este login do app (o painel segue valendo) e 403.
 */
export class RefreshMerchantSessionUseCase {
  constructor(private readonly deps: RefreshMerchantSessionDeps) {}

  async execute(input: {
    refreshToken: string;
    origin: RequestOrigin;
  }): Promise<MerchantSessionResult> {
    const { accounts, stores, sessions, tokens } = this.deps;
    const rotated = await sessions.rotate(
      MERCHANT_SESSION_AUDIENCE,
      input.refreshToken,
      input.origin,
    );
    const account = await accounts.findById(rotated.subjectId);
    if (account?.status !== "active") {
      await sessions.endAllFor(rotated.subjectId, MERCHANT_SESSION_AUDIENCE);
      throw new UnauthenticatedError(SESSION_ENDED);
    }
    let scope: MerchantScope;
    try {
      scope = await merchantScopeOf(account, stores);
    } catch (err) {
      await sessions.end(rotated.refreshToken);
      throw err;
    }
    return merchantSession(tokens, account, scope, {
      refreshToken: rotated.refreshToken,
      expiresAt: rotated.expiresAt,
      familyId: rotated.familyId,
    });
  }
}

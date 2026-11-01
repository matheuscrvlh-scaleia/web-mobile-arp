import type { App } from "@arp/contracts";
import type { StaffActor } from "../../../shared/application/actor";
import { scopedStoreId } from "../../../shared/application/store-scope";
import { ForbiddenError, NotFoundError, ValidationError } from "../../../shared/domain/errors";
import { canUseMerchantApp, type MerchantAccount } from "../domain/merchant";

/** Lojas vistas pelo app do lojista (query service). */
export interface MerchantStoreReader {
  /** Lojista: a loja dele (em qualquer situação). Sem loja: todas as ativas, por nome. */
  storesFor(storeId: string | null): Promise<App.MerchantStore[]>;
  find(storeId: string): Promise<App.MerchantStore | null>;
  exists(storeId: string): Promise<boolean>;
  /** Id da loja ativa quando só existe uma (0 ou 2+ → null). */
  soleActiveStoreId(): Promise<string | null>;
}

export const NO_MERCHANT_ACCESS = "Seu usuário não tem acesso ao painel do lojista no app";
export const NO_MERCHANT_STORE = "Nenhuma loja disponível para o seu usuário";
export const STORE_NOT_FOUND = "Loja não encontrada";

export interface MerchantScope {
  stores: App.MerchantStore[];
  /** Usuário sem loja: escolhe a loja em cada chamada. */
  allStores: boolean;
}

/**
 * Quem pode usar o app do lojista: precisa validar cupons (`coupons.redeem`)
 * e ter ao menos uma loja onde agir. Senha certa sem acesso → 403 (só quem
 * acerta a senha descobre que a conta não serve para o app).
 */
export async function merchantScopeOf(
  account: MerchantAccount,
  stores: MerchantStoreReader,
): Promise<MerchantScope> {
  if (!canUseMerchantApp(account)) throw new ForbiddenError(NO_MERCHANT_ACCESS);
  const list = await stores.storesFor(account.storeId);
  if (list.length === 0) throw new ForbiddenError(NO_MERCHANT_STORE);
  return { stores: list, allStores: account.storeId === null };
}

/**
 * Loja em que a chamada age. Lojista: sempre a dele (pedir outra → 403).
 * Sem loja (administrador, atendimento): a informada em `storeId`; omitir só
 * vale quando existe uma única loja ativa — não há "todas as lojas" no caixa.
 */
export async function resolveMerchantStore(
  actor: StaffActor,
  requested: string | undefined,
  stores: MerchantStoreReader,
): Promise<string> {
  const scoped = scopedStoreId(actor, requested);
  if (actor.storeId) return actor.storeId;
  if (scoped) {
    if (!(await stores.exists(scoped))) throw new NotFoundError(STORE_NOT_FOUND);
    return scoped;
  }
  const sole = await stores.soleActiveStoreId();
  if (!sole) throw ValidationError.field("storeId", "Escolha a loja");
  return sole;
}

/** O ator com a loja escolhida: os casos de uso do caixa aplicam o escopo por ela. */
export function actingInStore(actor: StaffActor, storeId: string): StaffActor {
  return { ...actor, storeId };
}

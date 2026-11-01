import { ForbiddenError } from "../domain/errors";
import type { Actor } from "./actor";

/**
 * Escopo de loja do lojista. Usuário com loja só enxerga a própria: o filtro
 * é forçado mesmo quando não vem na requisição, e pedir outra loja é 403.
 * Demais usuários: vale o filtro pedido (ou nenhum).
 */
export function scopedStoreId(actor: Actor, requested?: string | null): string | undefined {
  const own = actor.type === "staff" ? actor.storeId : null;
  if (!own) return requested ?? undefined;
  if (requested && requested !== own) throw new ForbiddenError("Você só pode acessar a sua loja");
  return own;
}

/** Lojista só age sobre registros da própria loja. */
export function assertStoreAccess(actor: Actor, storeId: string | null): void {
  const own = actor.type === "staff" ? actor.storeId : null;
  if (own && storeId !== own) throw new ForbiddenError("Você só pode acessar a sua loja");
}

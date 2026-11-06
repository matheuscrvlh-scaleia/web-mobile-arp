import { plural } from "@/shared/lib/format";
import { confirmar } from "@/shared/ui";

/** A partir de quantas lojas de uma vez o lote pergunta antes, mesmo sem cupom. */
const MANY = 5;

type Target = { name: string; activeCouponsCount: number };

/** "A, B e mais 2" (no máximo 3 nomes). */
function names(list: Target[]): string {
  const shown = list.slice(0, 3).map((s) => s.name);
  const rest = list.length - shown.length;
  if (rest > 0) return `${shown.join(", ")} e mais ${rest}`;
  if (shown.length <= 1) return shown.join("");
  return `${shown.slice(0, -1).join(", ")} e ${shown.at(-1)}`;
}

/**
 * Regra única para Desativar (topo da loja, ⋯ da lista e lote): pergunta antes
 * quando visitantes perdem algo agora (cupom no ar) ou quando são muitas lojas
 * de uma vez; senão aplica direto e o aviso oferece Desfazer.
 * Devolve `true` para seguir.
 */
export async function confirmDeactivate(stores: Target[]): Promise<boolean> {
  const withCoupons = stores.filter((s) => s.activeCouponsCount > 0);
  if (stores.length === 0) return false;
  if (withCoupons.length === 0 && stores.length < MANY) return true;

  const coupons = withCoupons.reduce((n, s) => n + s.activeCouponsCount, 0);
  const keep = "Quem já pegou cupom ainda pode usar no prazo. Dá para reativar depois.";

  if (stores.length === 1) {
    const [store] = stores as [Target];
    return confirmar({
      title: `Desativar ${store.name}?`,
      description: `A loja some do guia, do mapa e da busca do app, e ${coupons === 1 ? "o cupom no ar deixa" : `os ${coupons} cupons no ar deixam`} de aparecer. ${keep}`,
      confirmLabel: "Desativar loja",
      cancelLabel: "Manter ativa",
      danger: true,
    });
  }

  const couponText =
    withCoupons.length > 0
      ? ` ${withCoupons.length === 1 ? "Uma delas tem" : `${withCoupons.length} delas têm`} cupom no ar (${names(withCoupons)}): ${coupons === 1 ? "o cupom deixa" : `os ${coupons} cupons deixam`} de aparecer.`
      : "";
  return confirmar({
    title: `Desativar ${plural(stores.length, "loja", "lojas")}?`,
    description: `${names(stores)} somem do guia, do mapa e da busca do app.${couponText} ${keep}`,
    confirmLabel: `Desativar ${plural(stores.length, "loja", "lojas")}`,
    cancelLabel: "Manter ativas",
    danger: true,
  });
}

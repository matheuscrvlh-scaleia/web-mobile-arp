import type { CouponStock } from "@arp/contracts";
import { cn } from "@/shared/lib/cn";
import { formatNumber } from "@/shared/lib/format";

const MAX_SQUARES = 300;

const KINDS = [
  { key: "usado", label: "Usados", className: "estoque-usado" },
  { key: "aguardando", label: "Aguardando uso", className: "estoque-aguardando" },
  { key: "voltou", label: "Voltaram (livres de novo)", className: "estoque-voltou" },
  { key: "livre", label: "Livres", className: "estoque-livre" },
] as const;

/**
 * Divide o estoque nas quatro situações (soma = total). "Voltou" são
 * unidades que venceram sem uso e já podem ser pegas de novo: fazem parte
 * do que resta.
 */
export function splitStock(stock: CouponStock): [number, number, number, number] {
  const used = Math.min(stock.redeemed, stock.total);
  const waiting = Math.min(stock.waiting, stock.total - used);
  const remaining = Math.max(0, stock.total - used - waiting);
  const back = Math.min(stock.returned, remaining);
  return [used, waiting, back, remaining - back];
}

/**
 * Estoque em quadradinhos, como no painel do lojista do app: cada quadrado
 * é um cupom (com muitos, cada quadrado vale alguns). A legenda traz os
 * números, então a cor nunca fala sozinha.
 */
export function StockGrid({ stock, className }: { stock: CouponStock; className?: string }) {
  if (stock.total <= 0) {
    return <p className="py-6 text-center text-sm text-neutral-500">Sem estoque liberado.</p>;
  }
  const values = splitStock(stock);
  const per = Math.max(1, Math.ceil(stock.total / MAX_SQUARES));
  const squares = Math.ceil(stock.total / per);
  const kinds: number[] = [];
  values.forEach((v, k) => {
    const n = Math.round(v / per);
    for (let i = 0; i < n && kinds.length < squares; i++) kinds.push(k);
  });
  while (kinds.length < squares) kinds.push(3);
  const dense = squares > 60;
  return (
    <figure className={className}>
      <div
        aria-hidden
        className={cn(
          "grid gap-1",
          dense
            ? "grid-cols-[repeat(auto-fill,minmax(0.75rem,1fr))]"
            : "grid-cols-[repeat(auto-fill,minmax(1.4rem,1fr))]",
        )}
      >
        {kinds.map((k, i) => (
          <i
            // biome-ignore lint/suspicious/noArrayIndexKey: quadrados sem identidade própria
            key={i}
            className={cn("block rounded-[5px]", dense ? "h-3" : "h-6", KINDS[k]?.className)}
          />
        ))}
      </div>
      <figcaption className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-neutral-600">
        {KINDS.map((kind, i) => (
          <span key={kind.key} className="flex items-center gap-1.5">
            <i aria-hidden className={cn("size-3 rounded-[3px]", kind.className)} />
            {kind.label}:{" "}
            <b className="font-semibold tabular-nums">{formatNumber(values[i] ?? 0)}</b>
          </span>
        ))}
        {per > 1 && <span className="text-neutral-400">Cada quadrado ≈ {per} cupons</span>}
      </figcaption>
    </figure>
  );
}

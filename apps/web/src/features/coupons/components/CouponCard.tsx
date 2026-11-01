import { type Coupon, imageVariantUrl, type Tone } from "@arp/contracts";
import { cn } from "@/shared/lib/cn";
import { iconFor } from "@/shared/lib/icons";

/** O que o cartão precisa (a prévia do formulário monta isto sem a promoção salva). */
export interface CouponCardData {
  storeName: string;
  storeIcon: string;
  headline: string;
  headlineSub: string | null;
  title: string;
  tone: Tone;
  icon: string;
  imageUrl: string | null;
  redeemWindowHours: number;
  total: number;
  remaining: number;
}

export function couponCardData(c: Coupon): CouponCardData {
  return {
    storeName: c.store.name,
    storeIcon: c.store.icon,
    headline: c.headline,
    headlineSub: c.headlineSub,
    title: c.title,
    tone: c.tone,
    icon: c.icon,
    imageUrl: c.imageUrl,
    redeemWindowHours: c.redeemWindowHours,
    total: c.stock.total,
    remaining: c.stock.remaining,
  };
}

/**
 * Cartão do cupom como o app desenha (CpCard do protótipo): degradê do tom,
 * brilho, loja, destaque grande, título, barra "restam N" e o canhoto
 * tracejado com a foto (ou o ícone) e o prazo para usar. Cores fixas: é a
 * prévia do app, igual nos dois temas.
 */
export function CouponCard({
  data,
  className,
  notchClassName = "bg-neutral-100",
}: {
  data: CouponCardData;
  className?: string;
  /** Cor dos recortes do canhoto (a do fundo onde o cartão está). */
  notchClassName?: string;
}) {
  const light = data.tone === "sand";
  const soldOut = data.total > 0 && data.remaining <= 0;
  const pct = data.total > 0 ? Math.max(0, Math.min(100, (data.remaining / data.total) * 100)) : 0;
  const StoreIcon = iconFor(data.storeIcon);
  const Icon = iconFor(data.icon);
  return (
    <div
      className={cn(
        `tom-app-${data.tone}`,
        "relative grid min-h-[10.5rem] w-full grid-cols-[minmax(0,1fr)_6rem] overflow-hidden rounded-[1.75rem] text-left",
        soldOut && "opacity-70 grayscale-[0.85]",
        className,
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-16 size-56 rounded-full bg-[rgb(255_255_255/0.18)] blur-[30px]"
      />
      {soldOut && (
        <span className="absolute top-4 right-[6.9rem] z-[2] rounded-full bg-[#141714] px-2.5 py-1 text-[11px] font-semibold text-[#fff]">
          Esgotado
        </span>
      )}
      <div className="relative z-[1] flex min-w-0 flex-col py-[1.125rem] pr-1 pl-[1.125rem]">
        <p className="flex min-w-0 items-center gap-2 text-[13px] font-semibold">
          <span
            aria-hidden
            className={cn(
              "grid size-[1.625rem] shrink-0 place-items-center rounded-full",
              light ? "bg-[rgb(255_255_255/0.7)]" : "bg-[rgb(255_255_255/0.22)]",
            )}
          >
            <StoreIcon className="size-3.5" />
          </span>
          <span className="truncate">{data.storeName || "Loja"}</span>
        </p>
        <p className="mt-3 text-[2.5rem] leading-none font-extrabold tracking-[-0.055em] break-words">
          {data.headline || "—"}
          {data.headlineSub && (
            <small className="ml-1 text-[15px] font-semibold tracking-[-0.01em] opacity-80">
              {data.headlineSub}
            </small>
          )}
        </p>
        <p className="mt-1 truncate text-sm opacity-85">{data.title || "Título da promoção"}</p>
        <div className="mt-auto flex items-center gap-2.5 pt-3.5 text-xs font-semibold">
          {soldOut ? (
            <span>Pode voltar se alguém não usar</span>
          ) : (
            <>
              <span
                aria-hidden
                className={cn(
                  "h-1.5 max-w-[7.5rem] flex-1 overflow-hidden rounded-full",
                  light ? "bg-[rgb(20_23_20/0.1)]" : "bg-[rgb(255_255_255/0.25)]",
                )}
              >
                <i
                  className={cn(
                    "block h-full rounded-full transition-[width] duration-500",
                    light ? "bg-[#141714]" : "bg-[#fff]",
                  )}
                  style={{ width: `${pct}%` }}
                />
              </span>
              <span
                className={cn(
                  data.remaining <= 3 && "rounded-lg bg-[#c95a32] px-2 py-0.5 text-[#fff]",
                )}
              >
                restam {data.remaining}
              </span>
            </>
          )}
        </div>
      </div>
      <div
        className={cn(
          "relative grid place-items-center border-l-2 border-dashed",
          light ? "border-[rgb(20_23_20/0.15)]" : "border-[rgb(255_255_255/0.35)]",
        )}
      >
        <span
          aria-hidden
          className={cn("absolute -top-[11px] -left-3 size-[22px] rounded-full", notchClassName)}
        />
        <span
          aria-hidden
          className={cn("absolute -bottom-[11px] -left-3 size-[22px] rounded-full", notchClassName)}
        />
        <div className="flex flex-col items-center gap-2.5">
          <span
            aria-hidden
            className={cn(
              "grid size-[3.875rem] -rotate-[8deg] place-items-center rounded-[1.25rem] bg-cover bg-center shadow-[inset_0_1px_0_rgb(255_255_255/0.35)] backdrop-blur",
              light ? "bg-[rgb(255_255_255/0.7)]" : "bg-[rgb(255_255_255/0.18)]",
            )}
            style={
              data.imageUrl
                ? { backgroundImage: `url("${imageVariantUrl(data.imageUrl, 160)}")` }
                : undefined
            }
          >
            {!data.imageUrl && <Icon className="size-7" />}
          </span>
          <span className="text-[11px] font-bold opacity-80">
            {data.redeemWindowHours}h p/ usar
          </span>
        </div>
      </div>
    </div>
  );
}

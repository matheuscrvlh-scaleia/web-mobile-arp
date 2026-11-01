import type { CouponClaim } from "@arp/contracts";
import { Store, Timer, UserRound } from "lucide-react";
import { useNow } from "@/shared/hooks";
import { cn } from "@/shared/lib/cn";
import { formatCountdown, formatDateTime } from "@/shared/lib/format";
import { CLAIM_STATUS } from "./ClaimStatusBadge";

/**
 * O cupom pego como o visitante vê no app (ticket branco com picote):
 * loja, oferta, código, quem pegou e o prazo correndo. Cores fixas (é o
 * ticket do app), iguais nos dois temas.
 */
export function ClaimTicket({ claim, dimmed = false }: { claim: CouponClaim; dimmed?: boolean }) {
  return (
    <div className="rounded-[2rem] bg-[radial-gradient(circle_at_20%_0%,#7fd68d_0,transparent_45%),linear-gradient(180deg,#58c069,#3f9f50)] p-3 sm:p-5">
      <article
        aria-label={`Cupom ${claim.code}`}
        className={cn(
          "relative rounded-[1.75rem] bg-[#fff] text-[#141714] shadow-[0_30px_50px_-24px_rgb(16_60_24/0.55)]",
        )}
      >
        <div className="p-5 sm:p-6">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <span className="grid size-8 place-items-center rounded-xl bg-[#141714] text-[#fff]">
              <Store className="size-4" aria-hidden />
            </span>
            {claim.store.name}
          </p>
          <p className="mt-3 text-2xl leading-tight font-extrabold tracking-[-0.04em] sm:text-3xl">
            <span className="mr-2 text-[#2f7d3d]">{claim.coupon.headline}</span>
            {claim.coupon.title}
          </p>
        </div>
        <Tear />
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-3 p-5 sm:p-6",
            dimmed && "opacity-40 grayscale",
          )}
        >
          <p className="font-mono text-3xl font-extrabold tracking-[0.12em] tabular-nums sm:text-4xl">
            {claim.code}
          </p>
          <p className="flex items-center gap-2 text-sm text-[#5f655e]">
            <UserRound className="size-4" aria-hidden />
            <span>
              <span className="sr-only">Visitante: </span>
              <b className="font-semibold text-[#141714]">{claim.visitor.name}</b>
            </span>
          </p>
        </div>
        <Tear />
        <div className="p-5 sm:p-6">
          {claim.status === "active" ? (
            <Countdown claim={claim} />
          ) : (
            <p className="text-sm text-[#5f655e]">
              <b className="block text-lg font-bold text-[#141714]">
                {CLAIM_STATUS[claim.status].label}
              </b>
              {claim.status === "redeemed" && claim.redeemedAt
                ? `Em ${formatDateTime(claim.redeemedAt)}${claim.redeemedBy ? ` · ${claim.redeemedBy.name}` : ""}`
                : `Pegou em ${formatDateTime(claim.claimedAt)}`}
            </p>
          )}
        </div>
        {claim.status === "redeemed" && (
          <span
            aria-hidden
            className="absolute top-1/2 right-6 -translate-y-1/2 -rotate-12 rounded-xl border-4 border-[#2f7d3d] px-3 py-1 text-2xl font-black tracking-widest text-[#2f7d3d] opacity-80"
          >
            USADO
          </span>
        )}
      </article>
    </div>
  );
}

function Countdown({ claim }: { claim: CouponClaim }) {
  const now = useNow();
  const end = new Date(claim.expiresAt).getTime();
  const start = new Date(claim.claimedAt).getTime();
  const left = end - now;
  const pct = end > start ? Math.max(0, Math.min(100, (left / (end - start)) * 100)) : 0;
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p>
          <span className="block text-xs font-semibold tracking-wider text-[#5f655e] uppercase">
            {left > 0 ? "Use em até" : "Prazo"}
          </span>
          <span className="text-3xl font-extrabold tracking-tight tabular-nums">
            {left > 0 ? formatCountdown(left) : "Acabou agora"}
          </span>
        </p>
        <span className="grid size-12 place-items-center rounded-2xl bg-[#eef8ef] text-[#2f7d3d]">
          <Timer className="size-5" aria-hidden />
        </span>
      </div>
      <div aria-hidden className="mt-3 h-2 overflow-hidden rounded-full bg-[#f1efec]">
        <i
          className="block h-full rounded-full bg-[linear-gradient(90deg,#58c069,#2f7d3d)] transition-[width] duration-1000 ease-linear"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-[#5f655e]">Vence em {formatDateTime(claim.expiresAt)}</p>
    </div>
  );
}

/** Picote entre as partes do ticket. */
function Tear() {
  return (
    <div aria-hidden className="relative h-0 border-t-2 border-dashed border-[#e6e3df]">
      <span className="absolute -top-3 -left-3 size-6 rounded-full bg-[#4fae5f]" />
      <span className="absolute -top-3 -right-3 size-6 rounded-full bg-[#4fae5f]" />
    </div>
  );
}

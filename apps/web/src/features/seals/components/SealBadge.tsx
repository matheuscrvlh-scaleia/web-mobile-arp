import type { SealRef } from "@arp/contracts";
import { Lock } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { iconFor } from "@/shared/lib/icons";

const SIZES = { sm: 40, md: 56, lg: 72, xl: 112 } as const;

/**
 * Selo como o app desenha (Badge do protótipo): círculo no degradê do selo,
 * anel tracejado por dentro e o ícone no meio. Bloqueado (ainda não
 * conquistado) fica cinza com um cadeado — o cadeado também diz isso, não
 * só a cor.
 */
export function SealBadge({
  seal,
  size = "md",
  locked = false,
  className,
  label,
}: {
  seal: Pick<SealRef, "icon" | "gradientFrom" | "gradientTo"> & { name?: string };
  size?: keyof typeof SIZES | number;
  locked?: boolean;
  className?: string;
  /** Texto para leitores de tela (ex.: "Selo Explorador"); sem, é decorativo. */
  label?: string;
}) {
  const px = typeof size === "number" ? size : SIZES[size];
  const Icon = iconFor(seal.icon);
  return (
    <>
      {label && <span className="sr-only">{label}</span>}
      <span
        aria-hidden
        className={cn(
          "relative inline-grid shrink-0 place-items-center rounded-full text-[#fff]",
          locked && "text-[#b0aaa3]",
          className,
        )}
        style={{
          width: px,
          height: px,
          background: locked
            ? "#e3dfda"
            : `linear-gradient(145deg, ${seal.gradientFrom}, ${seal.gradientTo})`,
          boxShadow: locked ? undefined : `0 12px 22px -12px ${seal.gradientTo}`,
        }}
      >
        <span
          className={cn(
            "absolute rounded-full border-2 border-dashed",
            locked ? "border-[rgb(0_0_0/0.08)]" : "border-[rgb(255_255_255/0.45)]",
          )}
          style={{ inset: Math.max(3, px * 0.07) }}
        />
        <Icon
          className="relative drop-shadow-[0_2px_2px_rgb(0_0_0/0.2)]"
          style={{ width: px * 0.42, height: px * 0.42 }}
          strokeWidth={2}
        />
        {locked && (
          <span
            className="absolute -right-0.5 -bottom-0.5 grid place-items-center rounded-full bg-[#fff] text-[#8a847d] shadow-[0_2px_6px_rgb(0_0_0/0.1)]"
            style={{ width: Math.max(18, px * 0.34), height: Math.max(18, px * 0.34) }}
          >
            <Lock style={{ width: Math.max(10, px * 0.17), height: Math.max(10, px * 0.17) }} />
          </span>
        )}
      </span>
    </>
  );
}

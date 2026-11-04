import type { ChallengeAutoTrigger, ChallengeValidation } from "@arp/contracts";
import { CircleOff, type LucideIcon, Plug, QrCode, TicketCheck, Zap } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { StatusBadge } from "@/shared/ui";

export const VALIDATION: Record<
  ChallengeValidation,
  { label: string; icon: LucideIcon; hint: string }
> = {
  qr: {
    label: "QR Code",
    icon: QrCode,
    hint: "O visitante lê um QR Code mostrado pela loja ou pela ARP.",
  },
  auto: {
    label: "Automático",
    icon: Zap,
    hint: "O sistema dá o selo sozinho quando acontece o gatilho escolhido abaixo.",
  },
};

/** O que dá o selo num desafio automático. */
export const AUTO_TRIGGER: Record<
  ChallengeAutoTrigger,
  { label: string; icon: LucideIcon; hint: string }
> = {
  coupon_redeemed: {
    label: "Loja dá baixa no cupom",
    icon: TicketCheck,
    hint: "O visitante ganha o selo na hora em que o caixa da loja dá baixa no cupom escolhido, enquanto a campanha estiver no ar.",
  },
  integration: {
    label: "Integração",
    icon: Plug,
    hint: "Um sistema externo avisa a ARP (ex.: pagar o estacionamento pelo app).",
  },
};

/** Como o desafio é validado, com ícone e texto. */
export function ValidationPill({
  validation,
  className,
}: {
  validation: ChallengeValidation;
  className?: string;
}) {
  const v = VALIDATION[validation];
  const Icon = v.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        validation === "qr"
          ? "bg-neutral-900 text-white"
          : "bg-neutral-900/[0.06] text-neutral-700",
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {v.label}
    </span>
  );
}

export function ChallengeInactiveBadge() {
  return (
    <StatusBadge tone="neutral" icon={CircleOff}>
      Inativo (fora do app)
    </StatusBadge>
  );
}

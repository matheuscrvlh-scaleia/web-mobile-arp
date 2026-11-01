import type { ClaimStatus } from "@arp/contracts";
import { CircleCheck, CircleOff, type LucideIcon, RotateCcw, Timer } from "lucide-react";
import { StatusBadge, type StatusTone } from "@/shared/ui";

export const CLAIM_STATUS: Record<
  ClaimStatus,
  { label: string; tone: StatusTone; icon: LucideIcon }
> = {
  active: { label: "Aguardando uso", tone: "info", icon: Timer },
  redeemed: { label: "Usado", tone: "success", icon: CircleCheck },
  expired: { label: "Venceu (voltou)", tone: "warning", icon: RotateCcw },
  cancelled: { label: "Cancelado", tone: "neutral", icon: CircleOff },
};

/** Situação do cupom pego, com ícone e texto (a cor nunca vem sozinha). */
export function ClaimStatusBadge({ status }: { status: ClaimStatus }) {
  const s = CLAIM_STATUS[status];
  return (
    <StatusBadge tone={s.tone} icon={s.icon}>
      {s.label}
    </StatusBadge>
  );
}

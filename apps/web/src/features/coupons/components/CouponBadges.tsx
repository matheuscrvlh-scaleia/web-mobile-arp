import type { CouponStatus } from "@arp/contracts";
import { CircleCheck, CircleStop, type LucideIcon, Pause, PencilLine } from "lucide-react";
import { StatusBadge, type StatusTone } from "@/shared/ui";

export const COUPON_STATUS: Record<
  CouponStatus,
  { label: string; plural: string; tone: StatusTone; icon: LucideIcon }
> = {
  draft: { label: "Rascunho", plural: "Rascunhos", tone: "neutral", icon: PencilLine },
  active: { label: "Ativa", plural: "Ativas", tone: "success", icon: CircleCheck },
  paused: { label: "Pausada", plural: "Pausadas", tone: "warning", icon: Pause },
  ended: { label: "Encerrada", plural: "Encerradas", tone: "neutral", icon: CircleStop },
};

/** Situação da promoção, com ícone e texto. */
export function CouponStatusBadge({ status }: { status: CouponStatus }) {
  const s = COUPON_STATUS[status];
  return (
    <StatusBadge tone={s.tone} icon={s.icon}>
      {s.label}
    </StatusBadge>
  );
}

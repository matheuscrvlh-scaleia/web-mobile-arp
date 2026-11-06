import {
  COUPON_REVIEW_LABEL,
  type Coupon,
  type CouponLifecycle,
  type CouponReview,
} from "@arp/contracts";
import { CircleX, Hourglass } from "lucide-react";
import { formatDateShort } from "@/shared/lib/format";
import { type Lifecycle, LifecycleBadge, StatusBadge } from "@/shared/ui";

/** Situação da promoção (feminino: "a promoção") no selo padrão do sistema. */
export const COUPON_LIFECYCLE: Record<
  CouponLifecycle,
  { label: string; plural: string; badge: Lifecycle }
> = {
  draft: { label: "Rascunho", plural: "Rascunhos", badge: "draft" },
  scheduled: { label: "Agendada", plural: "Agendadas", badge: "scheduled" },
  active: { label: "Ativa", plural: "Ativas", badge: "active" },
  paused: { label: "Pausada", plural: "Pausadas", badge: "paused" },
  soldout: { label: "Esgotada", plural: "Esgotadas", badge: "soldOut" },
  ended: { label: "Encerrada", plural: "Encerradas", badge: "ended" },
  archived: { label: "Arquivada", plural: "Arquivadas", badge: "archived" },
};

/** Ordem do filtro de situação. */
export const LIFECYCLE_ORDER: CouponLifecycle[] = [
  "active",
  "scheduled",
  "draft",
  "paused",
  "soldout",
  "ended",
  "archived",
];

/** Dica curta ao lado do selo: quando começa, quando termina. */
function hintOf(c: Pick<Coupon, "lifecycle" | "startsAt" | "endsAt">): string | undefined {
  if (c.lifecycle === "scheduled") return `começa ${formatDateShort(c.startsAt)}`;
  if ((c.lifecycle === "active" || c.lifecycle === "soldout") && c.endsAt)
    return `até ${formatDateShort(c.endsAt)}`;
  return undefined;
}

/** Situação da promoção, com ícone, texto e (opcional) a dica de data. */
export function CouponStatusBadge({
  coupon,
  withHint = false,
}: {
  coupon: Pick<Coupon, "lifecycle" | "startsAt" | "endsAt">;
  withHint?: boolean;
}) {
  const s = COUPON_LIFECYCLE[coupon.lifecycle];
  return (
    <LifecycleBadge status={s.badge} label={s.label} hint={withHint ? hintOf(coupon) : undefined} />
  );
}

/** Revisão da ARP (Fase 2). Aprovado não ganha selo: é o normal. */
export function CouponReviewBadge({ review }: { review: CouponReview }) {
  if (review === "approved") return null;
  return (
    <StatusBadge
      tone={review === "pending" ? "warning" : "danger"}
      icon={review === "pending" ? Hourglass : CircleX}
    >
      {COUPON_REVIEW_LABEL[review]}
    </StatusBadge>
  );
}

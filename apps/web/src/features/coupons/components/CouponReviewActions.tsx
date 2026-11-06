import { type Coupon, weekdaysLabel } from "@arp/contracts";
import { Check, X } from "lucide-react";
import { useState } from "react";
import { errorMessage } from "@/shared/api";
import { useAuth } from "@/shared/auth";
import { cn } from "@/shared/lib/cn";
import { formatDateTime } from "@/shared/lib/format";
import { Button, Card, CardHeader, confirmar, Field, Modal, Textarea, toast } from "@/shared/ui";
import { useReviewCoupon } from "../api";
import { deadlineRule } from "../lib/deadline";

/** O que acontece no app ao aprovar, conforme a situação do cupom. */
function afterApproval(c: Coupon): string {
  switch (c.lifecycle) {
    case "active":
      return "Ele aparece no app agora e os visitantes já podem pegar.";
    case "scheduled":
      return `Ele entra no app em ${formatDateTime(c.startsAt)}.`;
    case "draft":
      return "Ele continua rascunho: vai ao app quando o lojista publicar.";
    default:
      return "Ele vai ao app quando voltar a ficar ativo.";
  }
}

/**
 * Aprovar / Recusar (com motivo) o cupom do lojista. Usado no detalhe e nas
 * linhas de "Aprovar cupons". Some para quem não tem coupons.approve.
 */
export function CouponReviewButtons({
  coupon,
  size = "sm",
  className,
}: {
  coupon: Coupon;
  /** "lg" na fila do celular: botões grandes, lado a lado. */
  size?: "sm" | "lg";
  className?: string;
}) {
  const { can } = useAuth();
  const review = useReviewCoupon();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  if (coupon.review === "approved" || !can("coupons.approve")) return null;

  // Aprovar pode pôr o cupom no app na hora: confirma com o nome e o efeito.
  const approve = async () => {
    const ok = await confirmar({
      title: `Aprovar “${coupon.title}”?`,
      description: afterApproval(coupon),
      confirmLabel: "Aprovar",
    });
    if (!ok) return;
    review.mutate(
      { id: coupon.id, decision: "approve" },
      {
        onSuccess: () => toast.success(`“${coupon.title}” aprovado.`),
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  };
  const reject = () =>
    review.mutate(
      { id: coupon.id, decision: "reject", note },
      {
        onSuccess: () => {
          toast.success("Cupom recusado. O lojista vê o motivo.");
          setRejecting(false);
          setNote("");
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );

  return (
    <span className={cn("inline-flex gap-2", className)}>
      {coupon.review === "pending" && (
        <Button
          size={size}
          variant="secondary"
          icon={X}
          onClick={() => setRejecting(true)}
          disabled={review.isPending}
        >
          Recusar
        </Button>
      )}
      <Button size={size} icon={Check} onClick={() => void approve()} loading={review.isPending}>
        Aprovar
      </Button>
      <Modal
        open={rejecting}
        onClose={() => setRejecting(false)}
        busy={review.isPending}
        dirty={note.trim().length > 0}
        size="sm"
        title={`Recusar “${coupon.title}”`}
        description="O lojista vê o motivo e pode corrigir."
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejecting(false)}>
              Voltar
            </Button>
            <Button
              variant="danger"
              onClick={reject}
              loading={review.isPending}
              disabled={!note.trim()}
            >
              Recusar
            </Button>
          </>
        }
      >
        <Field label="Motivo" required>
          <Textarea
            rows={3}
            maxLength={300}
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ex.: desconto acima do permitido"
          />
        </Field>
      </Modal>
    </span>
  );
}

/**
 * Revisão da ARP (Fase 2): o cupom do lojista só vai ao app depois de
 * aprovado. Mostra o cupom inteiro para conferir (ex.: evitar "500% OFF").
 */
export function CouponReviewCard({ coupon }: { coupon: Coupon }) {
  if (coupon.review === "approved") return null;
  return (
    <Card>
      <CardHeader
        title={coupon.review === "pending" ? "Aguardando a ARP" : "Recusado pela ARP"}
        description={
          coupon.review === "pending"
            ? "Criado ou alterado pelo lojista. Confira oferta, quantidade, dias e prazo antes de aprovar."
            : `Motivo: ${coupon.reviewNote ?? "—"}. O lojista pode corrigir e enviar de novo.`
        }
        action={<CouponReviewButtons coupon={coupon} />}
      />
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <dt className="text-neutral-500">Oferta</dt>
        <dd className="font-medium">
          {coupon.headline} {coupon.headlineSub ?? ""}
        </dd>
        <dt className="text-neutral-500">Quantidade</dt>
        <dd className="font-medium">{coupon.totalQuantity}</dd>
        <dt className="text-neutral-500">Dias</dt>
        <dd className="font-medium">{weekdaysLabel(coupon.weekdays)}</dd>
        <dt className="text-neutral-500">Prazo para usar</dt>
        <dd className="font-medium">{deadlineRule(coupon).title}</dd>
      </dl>
    </Card>
  );
}

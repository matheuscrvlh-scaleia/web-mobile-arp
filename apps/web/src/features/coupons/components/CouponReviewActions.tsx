import { type Coupon, weekdaysLabel } from "@arp/contracts";
import { Check, X } from "lucide-react";
import { useState } from "react";
import { errorMessage } from "@/shared/api";
import { useAuth } from "@/shared/auth";
import { Button, Card, CardHeader, Field, Modal, Textarea, toast } from "@/shared/ui";
import { useReviewCoupon } from "../api";

/**
 * Revisão da ARP (Fase 2): o cupom do lojista só vai ao app depois de
 * aprovado. Mostra o cupom inteiro para conferir (ex.: evitar "500% OFF").
 */
export function CouponReviewCard({ coupon }: { coupon: Coupon }) {
  const { can } = useAuth();
  const review = useReviewCoupon();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  if (coupon.review === "approved") return null;
  const canReview = can("coupons.approve");

  const approve = () =>
    review.mutate(
      { id: coupon.id, decision: "approve" },
      {
        onSuccess: () => toast.success("Cupom aprovado. Ele vai ao app quando estiver ativo."),
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
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
    <Card>
      <CardHeader
        title={coupon.review === "pending" ? "Aguardando a ARP" : "Recusado pela ARP"}
        description={
          coupon.review === "pending"
            ? "Criado ou alterado pelo lojista. Confira oferta, quantidade, dias e prazo antes de aprovar."
            : `Motivo: ${coupon.reviewNote ?? "—"}. O lojista pode corrigir e enviar de novo.`
        }
        action={
          canReview && (
            <span className="inline-flex gap-2">
              {coupon.review === "pending" && (
                <Button
                  size="sm"
                  variant="secondary"
                  icon={X}
                  onClick={() => setRejecting(true)}
                  disabled={review.isPending}
                >
                  Recusar
                </Button>
              )}
              <Button size="sm" icon={Check} onClick={approve} loading={review.isPending}>
                Aprovar
              </Button>
            </span>
          )
        }
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
        <dd className="font-medium">{coupon.redeemWindowHours} h depois de pegar</dd>
      </dl>
      <Modal
        open={rejecting}
        onClose={() => setRejecting(false)}
        busy={review.isPending}
        size="sm"
        title="Recusar cupom"
        description="O lojista vê o motivo e pode corrigir."
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejecting(false)}>
              Cancelar
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
    </Card>
  );
}

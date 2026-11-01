import type { Coupon, CouponStatus } from "@arp/contracts";
import { CircleStop, type LucideIcon, Pause, Play } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/shared/auth";
import { Button, ConfirmDialog, toast } from "@/shared/ui";
import { useChangeCouponStatus } from "../api";

type ActionKey = "activate" | "resume" | "pause" | "end";

interface Action {
  to: CouponStatus;
  label: string;
  icon: LucideIcon;
  title: string;
  description: string;
  confirm: string;
  done: string;
  danger?: boolean;
}

const ACTIONS: Record<ActionKey, Action> = {
  activate: {
    to: "active",
    label: "Ativar",
    icon: Play,
    title: "Ativar promoção?",
    description: "Ela aparece no app e os visitantes já podem pegar o cupom.",
    confirm: "Ativar",
    done: "Promoção ativada.",
  },
  resume: {
    to: "active",
    label: "Retomar",
    icon: Play,
    title: "Retomar promoção?",
    description: "Ela volta a aparecer no app com o estoque que restava.",
    confirm: "Retomar",
    done: "Promoção retomada.",
  },
  pause: {
    to: "paused",
    label: "Pausar",
    icon: Pause,
    title: "Pausar promoção?",
    description:
      "Ela some do app e ninguém pega cupom novo. Quem já pegou ainda usa dentro do prazo.",
    confirm: "Pausar",
    done: "Promoção pausada.",
  },
  end: {
    to: "ended",
    label: "Encerrar",
    icon: CircleStop,
    title: "Encerrar promoção?",
    description:
      "Não dá para reativar depois. Os cupons já pegos continuam valendo até o prazo de cada um.",
    confirm: "Encerrar",
    done: "Promoção encerrada.",
    danger: true,
  },
};

/** Próximos passos possíveis: rascunho → ativa ⇄ pausada → encerrada (final). */
export function availableActions(status: CouponStatus): ActionKey[] {
  switch (status) {
    case "draft":
      return ["activate"];
    case "active":
      return ["pause", "end"];
    case "paused":
      return ["resume", "end"];
    case "ended":
      return [];
  }
}

/** Ações rápidas de situação, cada uma com confirmação. Só com coupons.manage. */
export function CouponStatusActions({
  coupon,
  size = "sm",
}: {
  coupon: Pick<Coupon, "id" | "title" | "status">;
  size?: "sm" | "md";
}) {
  const { can } = useAuth();
  const change = useChangeCouponStatus();
  const [pending, setPending] = useState<ActionKey | null>(null);
  if (!can("coupons.manage")) return null;
  const keys = availableActions(coupon.status);
  if (keys.length === 0) return null;
  const action = pending ? ACTIONS[pending] : null;

  const close = () => {
    setPending(null);
    change.reset();
  };

  return (
    <>
      {keys.map((key) => {
        const a = ACTIONS[key];
        return (
          <Button
            key={key}
            size={size}
            variant={a.danger ? "ghost" : "secondary"}
            icon={a.icon}
            onClick={() => setPending(key)}
            aria-label={`${a.label}: ${coupon.title}`}
          >
            {a.label}
          </Button>
        );
      })}
      {action && (
        <ConfirmDialog
          open
          onClose={close}
          title={action.title}
          description={action.description}
          confirmLabel={action.confirm}
          danger={action.danger}
          loading={change.isPending}
          error={change.error}
          onConfirm={() =>
            change.mutate(
              { id: coupon.id, status: action.to },
              {
                onSuccess: () => {
                  toast.success(action.done);
                  close();
                },
              },
            )
          }
        />
      )}
    </>
  );
}

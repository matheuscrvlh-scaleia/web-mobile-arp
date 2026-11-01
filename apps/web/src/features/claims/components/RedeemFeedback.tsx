import type { ClaimStatus, CouponClaim } from "@arp/contracts";
import {
  Ban,
  CircleCheckBig,
  CircleX,
  Clock4,
  CopyX,
  type LucideIcon,
  SearchX,
  Store,
  TriangleAlert,
} from "lucide-react";
import type { ReactNode } from "react";
import { errorMessage, isApiError } from "@/shared/api";
import { cn } from "@/shared/lib/cn";
import { formatDateTime } from "@/shared/lib/format";

/** Desfechos que a tela de balcão explica com texto próprio. */
export type RedeemProblem =
  | "CLAIM_ALREADY_REDEEMED"
  | "CLAIM_EXPIRED"
  | "CLAIM_CANCELLED"
  | "CLAIM_WRONG_STORE"
  | "NOT_FOUND"
  | "OTHER";

const PROBLEMS: Record<
  Exclude<RedeemProblem, "OTHER">,
  { title: string; text: string; icon: LucideIcon }
> = {
  CLAIM_ALREADY_REDEEMED: {
    title: "Este cupom já foi usado",
    text: "O mesmo código não vale duas vezes.",
    icon: CopyX,
  },
  CLAIM_EXPIRED: {
    title: "O prazo deste cupom acabou",
    text: "Ele voltou para a promoção. Se ainda houver, o visitante pode pegar outro no app.",
    icon: Clock4,
  },
  CLAIM_CANCELLED: {
    title: "Cupom cancelado",
    text: "Este código não vale mais.",
    icon: Ban,
  },
  CLAIM_WRONG_STORE: {
    title: "Cupom de outra loja",
    text: "Este código só pode ser validado na loja da promoção.",
    icon: Store,
  },
  NOT_FOUND: {
    title: "Código não encontrado",
    text: "Confira as letras e os números com o visitante e digite de novo.",
    icon: SearchX,
  },
};

const STATUS_PROBLEM: Partial<Record<ClaimStatus, RedeemProblem>> = {
  redeemed: "CLAIM_ALREADY_REDEEMED",
  expired: "CLAIM_EXPIRED",
  cancelled: "CLAIM_CANCELLED",
};

/** Situação que impede validar, a partir do que a consulta devolveu. */
export const problemFromStatus = (status: ClaimStatus) => STATUS_PROBLEM[status] ?? null;

/** Código de erro da API → desfecho conhecido (ou genérico). */
export function problemFromError(error: unknown): RedeemProblem {
  if (!isApiError(error)) return "OTHER";
  if (error.code in PROBLEMS) return error.code as RedeemProblem;
  return "OTHER";
}

/** Faixa grande de resultado (verde no sucesso, vermelha no problema), com ícone e texto. */
function Banner({
  tone,
  icon: Icon,
  title,
  children,
  action,
}: {
  tone: "success" | "danger";
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-[1.75rem] p-5 sm:flex-row sm:items-center sm:p-6",
        tone === "success" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700",
      )}
    >
      <span
        className={cn(
          "grid size-14 shrink-0 place-items-center rounded-full text-[#fff]",
          tone === "success" ? "bg-[#2f7d3d]" : "bg-[#c0392b]",
        )}
      >
        <Icon className="size-7" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-2xl font-semibold tracking-tight">{title}</p>
        {children && <div className="mt-1 text-sm text-neutral-700">{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function RedeemSuccess({ claim }: { claim: CouponClaim }) {
  return (
    <Banner tone="success" icon={CircleCheckBig} title="Cupom validado!">
      <p>
        <b className="font-mono font-semibold">{claim.code}</b> · {claim.coupon.title} ·{" "}
        {claim.visitor.name}
      </p>
      <p className="mt-1 text-xs text-neutral-500">Pode digitar o próximo código.</p>
    </Banner>
  );
}

export function RedeemProblemBanner({
  problem,
  error,
  claim,
  action,
}: {
  problem: RedeemProblem;
  error?: unknown;
  claim?: CouponClaim;
  action?: ReactNode;
}) {
  if (problem === "OTHER") {
    return (
      <Banner tone="danger" icon={TriangleAlert} title="Não deu para concluir" action={action}>
        {errorMessage(error)}
      </Banner>
    );
  }
  const p = PROBLEMS[problem];
  return (
    <Banner tone="danger" icon={p.icon ?? CircleX} title={p.title} action={action}>
      <p>{p.text}</p>
      {problem === "CLAIM_ALREADY_REDEEMED" && claim?.redeemedAt && (
        <p className="mt-1 font-medium">
          Usado em {formatDateTime(claim.redeemedAt)}
          {claim.redeemedBy ? ` por ${claim.redeemedBy.name}` : ""}.
        </p>
      )}
      {problem === "CLAIM_EXPIRED" && claim && (
        <p className="mt-1 font-medium">Venceu em {formatDateTime(claim.expiresAt)}.</p>
      )}
      {problem === "CLAIM_WRONG_STORE" && claim && (
        <p className="mt-1 font-medium">É da {claim.store.name}.</p>
      )}
    </Banner>
  );
}

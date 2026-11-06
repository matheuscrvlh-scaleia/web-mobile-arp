import { STORE_GAP_LABEL, type StoreGap, type StoreStatus } from "@arp/contracts";
import { CircleOff, Clock, ClockAlert, ListChecks, Moon, TicketPercent } from "lucide-react";
import { plural } from "@/shared/lib/format";
import { StatusBadge } from "@/shared/ui";

export const STORE_STATUS_LABEL: Record<StoreStatus, string> = {
  active: "Ativa",
  inactive: "Inativa",
};

/** Itens que contam na completude do cadastro (mesma ordem do contrato). */
export const STORE_GAPS_TOTAL = Object.keys(STORE_GAP_LABEL).length;

export function StoreStatusBadge({ status }: { status: StoreStatus }) {
  return status === "active" ? (
    <StatusBadge tone="success">Ativa</StatusBadge>
  ) : (
    <StatusBadge tone="neutral" icon={CircleOff}>
      Inativa (fora do app)
    </StatusBadge>
  );
}

/**
 * "Aberta agora" / "Fechada agora", ou "Sem horário" quando a loja não tem
 * nenhum horário cadastrado (é falta de cadastro, não loja fechada).
 */
export function OpenNowBadge({ open, hasHours = true }: { open: boolean; hasHours?: boolean }) {
  if (!hasHours) {
    return (
      <StatusBadge tone="warning" icon={ClockAlert}>
        Sem horário
      </StatusBadge>
    );
  }
  return open ? (
    <StatusBadge tone="brand" icon={Clock}>
      Aberta agora
    </StatusBadge>
  ) : (
    <StatusBadge tone="neutral" icon={Moon}>
      Fechada agora
    </StatusBadge>
  );
}

export function CouponsBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <StatusBadge tone="warning" icon={TicketPercent}>
      {plural(count, "cupom ativo", "cupons ativos")}
    </StatusBadge>
  );
}

/** "Faltam: horário, logo" a partir da lista de pendências. */
export function describeGaps(missing: readonly StoreGap[]): string {
  const labels = missing.map((g) => STORE_GAP_LABEL[g]);
  if (labels.length <= 1) return labels.join("");
  return `${labels.slice(0, -1).join(", ")} e ${labels.at(-1)}`;
}

/** Completude do cadastro ("3/5"): some quando está completo. */
export function CompletenessBadge({ missing }: { missing: readonly StoreGap[] }) {
  if (missing.length === 0) return null;
  const done = STORE_GAPS_TOTAL - missing.length;
  return (
    <span title={`Falta: ${describeGaps(missing)}`}>
      <StatusBadge tone="neutral" icon={ListChecks}>
        Cadastro {done}/{STORE_GAPS_TOTAL}
        <span className="sr-only">. Falta: {describeGaps(missing)}</span>
      </StatusBadge>
    </span>
  );
}

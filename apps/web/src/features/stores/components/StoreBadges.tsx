import type { StoreStatus } from "@arp/contracts";
import { CircleOff, Clock, Moon, TicketPercent } from "lucide-react";
import { plural } from "@/shared/lib/format";
import { StatusBadge } from "@/shared/ui";

export const STORE_STATUS_LABEL: Record<StoreStatus, string> = {
  active: "Ativa",
  inactive: "Inativa",
};

export function StoreStatusBadge({ status }: { status: StoreStatus }) {
  return status === "active" ? (
    <StatusBadge tone="success">Ativa</StatusBadge>
  ) : (
    <StatusBadge tone="neutral" icon={CircleOff}>
      Inativa (fora do app)
    </StatusBadge>
  );
}

export function OpenNowBadge({ open }: { open: boolean }) {
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

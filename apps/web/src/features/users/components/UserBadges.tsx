import type { User } from "@arp/contracts";
import { CircleOff, KeyRound, Store } from "lucide-react";
import { StatusBadge } from "@/shared/ui";

export function UserStatusBadge({ user }: { user: Pick<User, "status" | "mustChangePassword"> }) {
  if (user.status === "disabled")
    return (
      <StatusBadge tone="neutral" icon={CircleOff}>
        Desativado
      </StatusBadge>
    );
  if (user.mustChangePassword)
    return (
      <StatusBadge tone="warning" icon={KeyRound}>
        Falta criar a senha
      </StatusBadge>
    );
  return <StatusBadge tone="success">Ativo</StatusBadge>;
}

export function StoreAccessBadge({ store }: { store: User["store"] }) {
  if (!store) return <span className="text-neutral-400">—</span>;
  return (
    <StatusBadge tone="info" icon={Store}>
      {store.name}
    </StatusBadge>
  );
}

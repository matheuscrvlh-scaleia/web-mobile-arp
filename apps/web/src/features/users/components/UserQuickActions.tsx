import type { User } from "@arp/contracts";
import { Power, PowerOff, Trash2 } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/shared/auth";
import { Button, ConfirmDialog, IconButton, toast } from "@/shared/ui";
import { useDeleteUser, useUpdateUser } from "../api";

/**
 * Desativar/reativar e excluir, com confirmação. `compact`: só ícones (linha da
 * lista). Ninguém desativa nem exclui a si mesmo; a API também recusa.
 */
export function UserQuickActions({
  user,
  compact = false,
  onDeleted,
}: {
  user: User;
  compact?: boolean;
  onDeleted?: () => void;
}) {
  const { can, user: me } = useAuth();
  const update = useUpdateUser(user.id);
  const remove = useDeleteUser();
  const [confirm, setConfirm] = useState<"status" | "delete" | null>(null);
  if (!can("users.manage") || me?.id === user.id) return null;

  const disabling = user.status === "active";
  const statusLabel = disabling ? "Desativar" : "Reativar";
  const StatusIcon = disabling ? PowerOff : Power;

  return (
    <>
      {compact ? (
        <>
          <IconButton
            size="sm"
            icon={StatusIcon}
            label={`${statusLabel} ${user.name}`}
            onClick={() => setConfirm("status")}
          />
          <IconButton
            size="sm"
            variant="danger"
            icon={Trash2}
            label={`Excluir ${user.name}`}
            onClick={() => setConfirm("delete")}
          />
        </>
      ) : (
        <>
          <Button
            variant={disabling ? "secondary" : "brand"}
            icon={StatusIcon}
            onClick={() => setConfirm("status")}
          >
            {statusLabel}
          </Button>
          <Button variant="danger" icon={Trash2} onClick={() => setConfirm("delete")}>
            Excluir
          </Button>
        </>
      )}

      <ConfirmDialog
        open={confirm === "status"}
        onClose={() => {
          setConfirm(null);
          update.reset();
        }}
        danger={disabling}
        title={disabling ? `Desativar ${user.name}?` : `Reativar ${user.name}?`}
        description={
          disabling
            ? "A pessoa perde o acesso ao painel na hora. O histórico do que ela fez continua."
            : "A pessoa volta a entrar com a senha que já tinha."
        }
        confirmLabel={statusLabel}
        loading={update.isPending}
        error={update.error}
        onConfirm={() =>
          update.mutate(
            { status: disabling ? "disabled" : "active" },
            {
              onSuccess: () => {
                setConfirm(null);
                toast.success(disabling ? "Usuário desativado." : "Usuário reativado.");
              },
            },
          )
        }
      />
      <ConfirmDialog
        open={confirm === "delete"}
        onClose={() => {
          setConfirm(null);
          remove.reset();
        }}
        danger
        title={`Excluir ${user.name} de vez?`}
        description="Não tem volta. Quem já tem registros no sistema (cupons, notificações) não pode ser excluído: nesse caso, desative."
        confirmLabel="Excluir"
        loading={remove.isPending}
        error={remove.error}
        onConfirm={() =>
          remove.mutate(user.id, {
            onSuccess: () => {
              setConfirm(null);
              toast.success(`${user.name} foi excluído.`);
              onDeleted?.();
            },
          })
        }
      />
    </>
  );
}

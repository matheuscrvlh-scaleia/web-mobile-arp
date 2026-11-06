import type { User } from "@arp/contracts";
import { Power, PowerOff, Trash2 } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/shared/auth";
import { ActionMenu, Button, ConfirmDialog, toast } from "@/shared/ui";
import { useDeleteUser, useUpdateUser } from "../api";

/**
 * Desativar/reativar e excluir (PLAN): no detalhe, a ação principal + "⋯ Mais";
 * na lista (`compact`), tudo no "⋯". Desativar tira o acesso: pede confirmação.
 * Reativar é na hora, com Desfazer. Excluir só para quem nunca usou o sistema.
 * Ninguém desativa nem exclui a si mesmo; a API também recusa.
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

  const setStatus = (status: "active" | "disabled", after?: () => void) =>
    update.mutate(
      { status },
      {
        onSuccess: () => {
          after?.();
          toast.success(
            status === "disabled"
              ? `Acesso de ${user.name} desativado: não entra mais no painel`
              : `Acesso de ${user.name} reativado`,
            {
              action: {
                label: "Desfazer",
                onClick: () =>
                  update.mutate(
                    { status: status === "disabled" ? "active" : "disabled" },
                    { onError: (e) => toast.fromError(e) },
                  ),
              },
            },
          );
        },
        onError: (e) => {
          if (!after) toast.fromError(e);
        },
      },
    );
  // Reativar devolve o acesso: é reversível, aplica na hora (regra 1).
  const onStatus = () => (disabling ? setConfirm("status") : setStatus("active"));

  const deleteItem = {
    label: "Excluir",
    icon: Trash2,
    danger: true,
    disabled: user.inUse === true,
    hint: user.inUse ? "Já tem registros no sistema: desative em vez de excluir" : undefined,
    onSelect: () => setConfirm("delete"),
  };

  return (
    <>
      {compact ? (
        <ActionMenu
          ariaLabel={`Mais ações de ${user.name}`}
          items={[{ label: statusLabel, icon: StatusIcon, onSelect: onStatus }, deleteItem]}
        />
      ) : (
        <>
          <Button
            variant={disabling ? "secondary" : "brand"}
            icon={StatusIcon}
            loading={!disabling && update.isPending}
            onClick={onStatus}
          >
            {statusLabel}
          </Button>
          <ActionMenu label="Mais" ariaLabel={`Mais ações de ${user.name}`} items={[deleteItem]} />
        </>
      )}

      <ConfirmDialog
        open={confirm === "status" && disabling}
        onClose={() => {
          setConfirm(null);
          update.reset();
        }}
        danger
        title={`Desativar ${user.name}?`}
        description="A pessoa perde o acesso ao painel na hora. O histórico do que ela fez continua, e dá para reativar depois."
        confirmLabel="Desativar"
        loading={update.isPending}
        error={update.error}
        onConfirm={() => setStatus("disabled", () => setConfirm(null))}
      />
      <ConfirmDialog
        open={confirm === "delete"}
        onClose={() => {
          setConfirm(null);
          remove.reset();
        }}
        danger
        title={`Excluir ${user.name} de vez?`}
        description="Não tem volta: a conta some do painel. O que a pessoa fez continua no Histórico."
        confirmLabel="Excluir"
        loading={remove.isPending}
        error={remove.error}
        onConfirm={() =>
          remove.mutate(user.id, {
            onSuccess: () => {
              setConfirm(null);
              toast.success(`${user.name} saiu do painel: conta excluída`);
              onDeleted?.();
            },
          })
        }
      />
    </>
  );
}

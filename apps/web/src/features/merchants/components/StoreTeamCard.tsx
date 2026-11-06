import type { MerchantInvite, MerchantSignup, StoreDetail, User } from "@arp/contracts";
import { Check, Link2, UserCheck, UserMinus, UserPlus, Users, X } from "lucide-react";
import { useState } from "react";
import { errorMessage } from "@/shared/api";
import { useAuth } from "@/shared/auth";
import { formatRelative } from "@/shared/lib/format";
import {
  Button,
  Card,
  CardHeader,
  confirmar,
  ErrorState,
  Skeleton,
  StatusBadge,
  toast,
} from "@/shared/ui";
import { useDecideSignup, useMerchantSignups, useSetMerchantAccess, useStoreTeam } from "../api";
import { ActiveInvites, InviteLinkResult, useGenerateInvite } from "./InviteLink";

/** Pergunta antes de tirar o acesso (afeta quem está usando o painel agora). */
export async function confirmRemoveAccess(name: string, storeName: string): Promise<boolean> {
  return confirmar({
    title: `Remover o acesso de ${name}?`,
    description: `${name} sai do painel da ${storeName} na hora (a sessão aberta cai) e não consegue mais entrar. Cupons, vagas e o histórico da loja continuam. Dá para devolver o acesso depois.`,
    confirmLabel: "Remover acesso",
    cancelLabel: "Manter acesso",
    danger: true,
  });
}

/** Recusar não tem volta (o cadastro não volta para a espera): pergunta antes. */
export async function confirmRejectSignup(name: string, storeName: string): Promise<boolean> {
  return confirmar({
    title: `Recusar o cadastro de ${name}?`,
    description: `${name} não entra no painel da ${storeName}. Para tentar de novo, a pessoa precisa se cadastrar outra vez por um link de convite valendo.`,
    confirmLabel: "Recusar cadastro",
    cancelLabel: "Voltar",
    danger: true,
  });
}

/**
 * Equipe da loja, na página da loja: quem acessa o painel por ela, os
 * cadastros esperando aprovação, os links valendo e o botão de convidar.
 * Tudo o que antes ficava espalhado em Lojistas e Usuários.
 */
export function StoreTeamCard({ store }: { store: StoreDetail }) {
  const { can } = useAuth();
  const canApprove = can("merchants.approve");
  const canSeeUsers = can("users.view");
  const canManageUsers = can("users.manage");
  const team = useStoreTeam(store.id, { enabled: canSeeUsers });
  const pending = useMerchantSignups(
    { storeId: store.id, status: "pending" },
    { enabled: canApprove },
  );
  const decide = useDecideSignup();
  const access = useSetMerchantAccess();
  const invite = useGenerateInvite();
  const [created, setCreated] = useState<MerchantInvite | null>(null);

  const setAccess = async (u: User, active: boolean) => {
    if (!active && !(await confirmRemoveAccess(u.name, store.name))) return;
    access.mutate(
      { userId: u.id, active },
      {
        onSuccess: () =>
          toast.success(
            active ? `${u.name} voltou a ter acesso.` : `Acesso de ${u.name} removido.`,
          ),
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  };

  const act = async (s: MerchantSignup, approve: boolean) => {
    if (!approve && !(await confirmRejectSignup(s.name, store.name))) return;
    decide.mutate(
      { id: s.id, approve },
      {
        onSuccess: () =>
          toast.success(
            approve ? `${s.name} aprovado. O aviso foi enviado.` : "Cadastro recusado.",
          ),
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  };

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader
          title="Equipe da loja"
          description="Quem entra no painel por esta loja (cupons, vagas, validar no balcão)."
          icon={Users}
        />
        {!canSeeUsers ? (
          <p className="text-sm text-neutral-500">Você não tem acesso à lista de usuários.</p>
        ) : team.error ? (
          <ErrorState compact error={team.error} onRetry={() => void team.refetch()} />
        ) : !team.data ? (
          <Skeleton className="h-20 rounded-2xl" />
        ) : team.data.length === 0 ? (
          <p className="text-sm text-neutral-500">
            Ninguém da loja tem acesso ainda. Gere um link de convite ao lado.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-neutral-900/[0.06]">
            {team.data.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
                {/* No celular, nome e e-mail ganham a linha toda; selo e botão vão para baixo. */}
                <div className="min-w-0 flex-1 basis-full sm:basis-0">
                  <p className="truncate text-sm font-medium">{u.name}</p>
                  <p className="text-xs text-neutral-500 [overflow-wrap:anywhere]">
                    {u.email} ·{" "}
                    {u.lastLoginAt
                      ? `último acesso ${formatRelative(u.lastLoginAt)}`
                      : "ainda não entrou"}
                  </p>
                </div>
                {u.status === "active" ? (
                  <StatusBadge tone="success">Com acesso</StatusBadge>
                ) : (
                  <StatusBadge tone="neutral">Sem acesso</StatusBadge>
                )}
                {canManageUsers &&
                  (u.status === "active" ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={UserMinus}
                      onClick={() => void setAccess(u, false)}
                    >
                      Remover acesso
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={UserCheck}
                      onClick={() => void setAccess(u, true)}
                    >
                      Devolver acesso
                    </Button>
                  ))}
              </li>
            ))}
          </ul>
        )}

        {canApprove && (pending.data?.length ?? 0) > 0 && (
          <div className="mt-5">
            <p className="mb-2 text-xs font-semibold tracking-wide text-neutral-500 uppercase">
              Esperando aprovação
            </p>
            <ul className="flex flex-col divide-y divide-neutral-900/[0.06]">
              {pending.data?.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
                  {/* No celular, nome e e-mail ganham a linha toda; os botões vão para baixo. */}
                  <div className="min-w-0 flex-1 basis-full sm:basis-0">
                    <p className="truncate text-sm font-medium">{s.name}</p>
                    <p className="text-xs text-neutral-500 [overflow-wrap:anywhere]">
                      {[s.email, s.phone].filter(Boolean).join(" · ")} · pediu{" "}
                      {formatRelative(s.createdAt)}
                    </p>
                  </div>
                  <span className="inline-flex gap-1.5">
                    <Button
                      size="sm"
                      icon={Check}
                      loading={
                        decide.isPending &&
                        decide.variables?.id === s.id &&
                        decide.variables.approve
                      }
                      onClick={() => void act(s, true)}
                    >
                      Aprovar
                    </Button>
                    <Button size="sm" variant="ghost" icon={X} onClick={() => void act(s, false)}>
                      Recusar
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {canApprove && (
        <Card>
          <CardHeader
            title="Convidar lojista"
            description="O link vale 7 dias e serve para mais de uma pessoa da loja. Quem se cadastra só entra depois que você aprova."
            icon={Link2}
          />
          <Button
            icon={UserPlus}
            loading={invite.isPending}
            onClick={() => invite.generate(store, setCreated)}
          >
            {created ? "Gerar outro link" : "Gerar link de convite"}
          </Button>
          {created && <InviteLinkResult invite={created} whatsapp={store.whatsapp} />}
          <p className="mt-5 mb-1 text-xs font-semibold tracking-wide text-neutral-500 uppercase">
            Links ativos
          </p>
          <ActiveInvites storeId={store.id} compact />
        </Card>
      )}
    </div>
  );
}

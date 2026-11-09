import type { MerchantInvite, MerchantSignup, MerchantSignupStatus } from "@arp/contracts";
import { Check, Link2, Link2Off, UserCheck, UserMinus, X } from "lucide-react";
import { useState } from "react";
import { StoreSelect, useStoreOptions } from "@/features/stores";
import { errorMessage } from "@/shared/api";
import { useAuth } from "@/shared/auth";
import { PATHS } from "@/shared/config/paths";
import { formatDateTime } from "@/shared/lib/format";
import {
  Button,
  Card,
  CardHeader,
  type Column,
  EmptyState,
  ErrorState,
  Field,
  PageHeader,
  Select,
  StatusBadge,
  type StatusTone,
  Table,
  toast,
} from "@/shared/ui";
import { useDecideSignup, useMerchantSignups, useSetMerchantAccess } from "../api";
import { ActiveInvites, InviteLinkResult, useGenerateInvite } from "../components/InviteLink";
import { confirmRejectSignup, confirmRemoveAccess } from "../components/StoreTeamCard";

const STATUS: Record<MerchantSignupStatus, { label: string; tone: StatusTone }> = {
  pending: { label: "Aguardando", tone: "warning" },
  approved: { label: "Aprovado", tone: "success" },
  rejected: { label: "Recusado", tone: "neutral" },
};

/** Lojistas (Fase 2): a ARP gera o link de cadastro, aprova ou recusa e tira o acesso. */
export function MerchantsPage() {
  return (
    <>
      <PageHeader
        title="Lojistas"
        description="Mande o link de cadastro para a loja. O lojista só entra depois de aprovado e recebe o aviso por e-mail. A equipe de cada loja também aparece na página da loja, aba Equipe."
      />
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <InviteCard />
          <Card>
            <CardHeader
              title="Links ativos"
              description="Links que ainda abrem o cadastro. Cancele se mandou para a pessoa errada."
              icon={Link2Off}
            />
            <ActiveInvites />
          </Card>
        </div>
        <SignupsCard />
      </div>
    </>
  );
}

function InviteCard() {
  const invite = useGenerateInvite();
  const stores = useStoreOptions();
  const [storeId, setStoreId] = useState<string | null>(null);
  const [created, setCreated] = useState<MerchantInvite | null>(null);

  return (
    <Card data-guia="link-convite">
      <CardHeader
        title="Link de cadastro"
        description="Vale 7 dias e serve para mais de uma pessoa da mesma loja."
        icon={Link2}
      />
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Loja" className="min-w-64 flex-1">
          <StoreSelect
            value={storeId}
            onChange={(v) => {
              setStoreId(v);
              setCreated(null);
            }}
          />
        </Field>
        <Button
          data-guia="criar"
          disabled={!storeId}
          loading={invite.isPending}
          onClick={() =>
            storeId &&
            invite.generate(
              {
                id: storeId,
                name: stores.data?.find((s) => s.id === storeId)?.name ?? "Esta loja",
              },
              setCreated,
            )
          }
        >
          Gerar link
        </Button>
      </div>
      {created && <InviteLinkResult invite={created} />}
    </Card>
  );
}

function SignupsCard() {
  const { can } = useAuth();
  const canManageUsers = can("users.manage");
  const [status, setStatus] = useState<MerchantSignupStatus | "">("pending");
  const list = useMerchantSignups(status ? { status } : {});
  const decide = useDecideSignup();
  const access = useSetMerchantAccess();

  const act = async (s: MerchantSignup, approve: boolean) => {
    if (!approve && !(await confirmRejectSignup(s.name, s.store.name))) return;
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

  const setAccess = async (s: MerchantSignup, active: boolean) => {
    if (!s.user) return;
    if (!active && !(await confirmRemoveAccess(s.name, s.store.name))) return;
    access.mutate(
      { userId: s.user.id, active },
      {
        onSuccess: () =>
          toast.success(
            active ? `${s.name} voltou a ter acesso.` : `Acesso de ${s.name} removido.`,
          ),
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  };

  const columns: Column<MerchantSignup>[] = [
    {
      key: "name",
      header: "Lojista",
      primary: true,
      cell: (s) => (
        <span className="flex flex-col">
          <span className="font-medium">{s.name}</span>
          <span className="text-xs text-neutral-500">
            {[s.email, s.phone].filter(Boolean).join(" · ")}
          </span>
        </span>
      ),
    },
    { key: "store", header: "Loja", cell: (s) => s.store.name },
    {
      key: "at",
      header: "Cadastro",
      cell: (s) => formatDateTime(s.createdAt),
      hideOnMobile: true,
    },
    {
      key: "status",
      header: "Situação",
      status: true,
      cell: (s) =>
        s.status === "approved" && s.user?.status === "disabled" ? (
          <StatusBadge tone="neutral">Acesso removido</StatusBadge>
        ) : (
          <StatusBadge tone={STATUS[s.status].tone}>{STATUS[s.status].label}</StatusBadge>
        ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Ações</span>,
      numeric: true,
      cell: (s) =>
        s.status === "pending" ? (
          <span className="inline-flex gap-1.5">
            <Button
              data-guia="aprovar"
              size="sm"
              icon={Check}
              loading={
                decide.isPending && decide.variables?.id === s.id && decide.variables.approve
              }
              onClick={() => void act(s, true)}
            >
              Aprovar
            </Button>
            <Button size="sm" variant="ghost" icon={X} onClick={() => void act(s, false)}>
              Recusar
            </Button>
          </span>
        ) : s.status === "approved" && s.user && canManageUsers ? (
          s.user.status === "active" ? (
            <Button
              size="sm"
              variant="ghost"
              icon={UserMinus}
              loading={access.isPending && access.variables?.userId === s.user.id}
              onClick={() => void setAccess(s, false)}
            >
              Remover acesso
            </Button>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              icon={UserCheck}
              loading={access.isPending && access.variables?.userId === s.user.id}
              onClick={() => void setAccess(s, true)}
            >
              Devolver acesso
            </Button>
          )
        ) : null,
    },
  ];

  return (
    <Card>
      <CardHeader
        title="Cadastros"
        description="Confira a loja e o e-mail antes de aprovar."
        icon={UserCheck}
        action={
          <Select
            aria-label="Situação"
            value={status}
            onChange={(e) => setStatus(e.target.value as MerchantSignupStatus | "")}
            className="w-40"
          >
            <option value="">Todos</option>
            {Object.entries(STATUS).map(([value, s]) => (
              <option key={value} value={value}>
                {s.label}
              </option>
            ))}
          </Select>
        }
      />
      {list.error ? (
        <ErrorState compact error={list.error} onRetry={() => void list.refetch()} />
      ) : (
        <Table
          caption="Cadastros de lojista"
          columns={columns}
          rows={list.data}
          rowKey={(s) => s.id}
          loading={list.isLoading}
          skeletonRows={4}
          mobile="cards"
          rowHref={(s) => PATHS.store(s.store.id, "equipe")}
          rowLabel={(s) => `${s.name}, ${s.store.name}`}
          empty={<EmptyState compact icon={UserCheck} title="Nenhum cadastro aqui" />}
        />
      )}
    </Card>
  );
}

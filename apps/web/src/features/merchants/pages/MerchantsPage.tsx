import type { MerchantInvite, MerchantSignup, MerchantSignupStatus } from "@arp/contracts";
import { Check, Link2, UserCheck, X } from "lucide-react";
import { useState } from "react";
import { useStoreOptions } from "@/features/stores";
import { errorMessage } from "@/shared/api";
import { formatDateTime } from "@/shared/lib/format";
import {
  Button,
  Card,
  CardHeader,
  type Column,
  CopyButton,
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
import { useCreateInvite, useDecideSignup, useMerchantSignups } from "../api";

const STATUS: Record<MerchantSignupStatus, { label: string; tone: StatusTone }> = {
  pending: { label: "Aguardando", tone: "warning" },
  approved: { label: "Aprovado", tone: "success" },
  rejected: { label: "Recusado", tone: "neutral" },
};

/** Lojistas (Fase 2): a ARP gera o link de cadastro e aprova ou recusa. */
export function MerchantsPage() {
  return (
    <>
      <PageHeader
        title="Lojistas"
        description="Mande o link de cadastro para a loja. O lojista só entra depois de aprovado e recebe o aviso por e-mail."
      />
      <div className="flex flex-col gap-5">
        <InviteCard />
        <SignupsCard />
      </div>
    </>
  );
}

function InviteCard() {
  const stores = useStoreOptions();
  const invite = useCreateInvite();
  const [storeId, setStoreId] = useState("");
  const [created, setCreated] = useState<MerchantInvite | null>(null);
  const url = created ? `${window.location.origin}/cadastro-lojista/${created.token}` : "";

  return (
    <Card>
      <CardHeader
        title="Link de cadastro"
        description="Vale 7 dias e serve para mais de uma pessoa da mesma loja."
        icon={Link2}
      />
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Loja" className="min-w-64 flex-1">
          <Select
            placeholder="Escolha a loja"
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
          >
            {(stores.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Button
          disabled={!storeId}
          loading={invite.isPending}
          onClick={() =>
            invite.mutate(storeId, {
              onSuccess: setCreated,
              onError: (e) => toast.error(errorMessage(e)),
            })
          }
        >
          Gerar link
        </Button>
      </div>
      {created && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-neutral-900/[0.04] p-3">
          <code className="min-w-0 flex-1 break-all text-sm">{url}</code>
          <CopyButton value={url} label="Copiar link" />
          <p className="w-full text-xs text-neutral-500">
            Link da {created.store.name}, vale até {formatDateTime(created.expiresAt)}. Mande por
            e-mail ou WhatsApp.
          </p>
        </div>
      )}
    </Card>
  );
}

function SignupsCard() {
  const [status, setStatus] = useState<MerchantSignupStatus | "">("pending");
  const list = useMerchantSignups(status ? { status } : {});
  const decide = useDecideSignup();

  const act = (s: MerchantSignup, approve: boolean) =>
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

  const columns: Column<MerchantSignup>[] = [
    {
      key: "name",
      header: "Lojista",
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
    { key: "at", header: "Cadastro", cell: (s) => formatDateTime(s.createdAt) },
    {
      key: "status",
      header: "Situação",
      cell: (s) => <StatusBadge tone={STATUS[s.status].tone}>{STATUS[s.status].label}</StatusBadge>,
    },
    {
      key: "actions",
      header: <span className="sr-only">Ações</span>,
      numeric: true,
      cell: (s) =>
        s.status === "pending" && (
          <span className="inline-flex gap-1.5">
            <Button
              size="sm"
              icon={Check}
              loading={
                decide.isPending && decide.variables?.id === s.id && decide.variables.approve
              }
              onClick={() => act(s, true)}
            >
              Aprovar
            </Button>
            <Button size="sm" variant="ghost" icon={X} onClick={() => act(s, false)}>
              Recusar
            </Button>
          </span>
        ),
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
          empty={<EmptyState compact icon={UserCheck} title="Nenhum cadastro aqui" />}
        />
      )}
    </Card>
  );
}

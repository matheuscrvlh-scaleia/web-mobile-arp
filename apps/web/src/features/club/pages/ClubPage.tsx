import {
  type Permission,
  PRIZE_KIND_LABEL,
  type Prize,
  type PrizeRedemption,
  type PrizeRedemptionStatus,
  type RankingEntry,
  type SealsReportRow,
} from "@arp/contracts";
import { Gift, Medal, PackageCheck, Pencil, Plus, Store, Trash2 } from "lucide-react";
import { useState } from "react";
import { errorMessage } from "@/shared/api";
import { useAuth } from "@/shared/auth";
import { useSearchParamOption } from "@/shared/hooks";
import { addDaysIso, todayIso } from "@/shared/lib/dates";
import { formatDateTime, formatNumber } from "@/shared/lib/format";
import {
  Button,
  Card,
  CardHeader,
  type Column,
  ConfirmDialog,
  DemoMark,
  EmptyState,
  ErrorState,
  Field,
  FieldRow,
  IconButton,
  Input,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  StatusBadge,
  type StatusTone,
  type TabItem,
  Table,
  TabPanel,
  Tabs,
  toast,
} from "@/shared/ui";
import {
  useDeletePrize,
  useDeliverRedemption,
  usePrizes,
  useRanking,
  useRedemptions,
  useSealsReport,
} from "../api";
import { PrizeFormModal } from "../components/PrizeFormModal";

type Tab = "lojinha" | "trocas" | "ranking";
const TABS: (TabItem<Tab> & { permission: Permission | null })[] = [
  { value: "lojinha", label: "Lojinha", icon: Gift, permission: null },
  { value: "trocas", label: "Trocas", icon: PackageCheck, permission: "club.manage" },
  { value: "ranking", label: "Ranking", icon: Medal, permission: "reports.view" },
];

/** Clube ARP (Fase 2): lojinha, trocas e ranking (cada aba com a sua permissão). */
export function ClubPage() {
  const { can } = useAuth();
  const canEdit = can("club.manage");
  const tabs = TABS.filter((t) => t.permission === null || can(t.permission));
  const [tab, setTab] = useSearchParamOption<Tab>(
    "aba",
    tabs.map((t) => t.value),
    "lojinha",
  );

  return (
    <>
      <PageHeader
        title="Clube ARP"
        description="Selos valem pontos, que o visitante troca por prêmios na lojinha. O ranking mostra só apelidos."
      />
      <Tabs
        idBase="clube"
        label="Clube ARP"
        items={tabs}
        value={tab}
        onChange={setTab}
        className="mb-5"
      />
      <TabPanel idBase="clube" value={tab}>
        {tab === "lojinha" ? (
          <PrizesTab canEdit={canEdit} />
        ) : tab === "trocas" ? (
          <RedemptionsTab canEdit={canEdit} />
        ) : (
          <RankingTab />
        )}
      </TabPanel>
    </>
  );
}

/* Lojinha ----------------------------------------------------------------- */

function PrizesTab({ canEdit }: { canEdit: boolean }) {
  const prizes = usePrizes();
  const remove = useDeletePrize();
  const [editing, setEditing] = useState<Prize | "new" | null>(null);
  const [deleting, setDeleting] = useState<Prize | null>(null);

  const columns: Column<Prize>[] = [
    {
      key: "name",
      header: "Prêmio",
      cell: (p) => (
        <span className="flex flex-col">
          <span className="inline-flex items-center gap-1.5 font-medium">
            {p.name}
            <DemoMark show={p.isDemo} />
          </span>
          <span className="text-xs text-neutral-500">{PRIZE_KIND_LABEL[p.kind]}</span>
        </span>
      ),
    },
    { key: "points", header: "Pontos", numeric: true, cell: (p) => formatNumber(p.points) },
    { key: "stock", header: "Estoque", numeric: true, cell: (p) => formatNumber(p.stock) },
    {
      key: "redeemed",
      header: "Trocados",
      numeric: true,
      cell: (p) => formatNumber(p.redeemedCount),
    },
    {
      key: "enough",
      header: "Já podem trocar",
      numeric: true,
      cell: (p) => formatNumber(p.visitorsEnough),
    },
    {
      key: "almost",
      header: "Perto (80%+)",
      numeric: true,
      cell: (p) => formatNumber(p.visitorsAlmost),
    },
    {
      key: "status",
      header: "App",
      cell: (p) => (
        <StatusBadge tone={p.active && p.stock > 0 ? "success" : "neutral"}>
          {!p.active ? "Oculto" : p.stock > 0 ? "Na lojinha" : "Esgotado"}
        </StatusBadge>
      ),
    },
    ...(canEdit
      ? [
          {
            key: "actions",
            header: <span className="sr-only">Ações</span>,
            numeric: true,
            cell: (p: Prize) => (
              <span className="inline-flex gap-1">
                <IconButton
                  icon={Pencil}
                  size="sm"
                  label={`Editar ${p.name}`}
                  onClick={() => setEditing(p)}
                />
                <IconButton
                  icon={Trash2}
                  size="sm"
                  variant="danger"
                  label={`Apagar ${p.name}`}
                  onClick={() => setDeleting(p)}
                />
              </span>
            ),
          },
        ]
      : []),
  ];

  return (
    <Card>
      <CardHeader
        title="Lojinha"
        description="“Já podem trocar” e “Perto” ajudam a decidir quanto comprar de cada prêmio."
        action={
          canEdit && (
            <Button size="sm" variant="secondary" icon={Plus} onClick={() => setEditing("new")}>
              Novo prêmio
            </Button>
          )
        }
      />
      {prizes.error ? (
        <ErrorState compact error={prizes.error} onRetry={() => void prizes.refetch()} />
      ) : (
        <Table
          caption="Prêmios da lojinha"
          columns={columns}
          rows={prizes.data}
          rowKey={(p) => p.id}
          loading={prizes.isLoading}
          skeletonRows={4}
          empty={<EmptyState compact icon={Gift} title="Nenhum prêmio ainda" />}
        />
      )}
      <PrizeFormModal
        open={editing !== null}
        prize={editing === "new" || editing === null ? undefined : editing}
        onClose={() => setEditing(null)}
      />
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => {
          setDeleting(null);
          remove.reset();
        }}
        danger
        title={`Apagar ${deleting?.name ?? "o prêmio"}?`}
        description="Prêmio já trocado não pode ser apagado: desative."
        confirmLabel="Apagar"
        loading={remove.isPending}
        error={remove.error}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting.id, {
            onSuccess: () => {
              toast.success("Prêmio apagado.");
              setDeleting(null);
            },
          })
        }
      />
    </Card>
  );
}

/* Trocas ------------------------------------------------------------------ */

const REDEMPTION_STATUS: Record<PrizeRedemptionStatus, { label: string; tone: StatusTone }> = {
  pending: { label: "Para retirar", tone: "warning" },
  delivered: { label: "Entregue", tone: "success" },
  cancelled: { label: "Cancelada", tone: "neutral" },
};

function RedemptionsTab({ canEdit }: { canEdit: boolean }) {
  const [status, setStatus] = useState<PrizeRedemptionStatus | "">("pending");
  const [code, setCode] = useState("");
  const [page, setPage] = useState(1);
  const query = {
    page,
    pageSize: 20,
    ...(status ? { status } : {}),
    ...(code.trim() ? { code: code.trim() } : {}),
  };
  const list = useRedemptions(query);
  const deliver = useDeliverRedemption();

  const columns: Column<PrizeRedemption>[] = [
    {
      key: "code",
      header: "Código",
      cell: (r) => <span className="font-mono font-semibold">{r.code}</span>,
    },
    { key: "prize", header: "Prêmio", cell: (r) => r.prize.name },
    {
      key: "visitor",
      header: "Visitante",
      cell: (r) => (
        <span className="inline-flex items-center gap-1.5">
          {r.visitor.name}
          <DemoMark show={r.isDemo} />
        </span>
      ),
    },
    { key: "points", header: "Pontos", numeric: true, cell: (r) => formatNumber(r.points) },
    { key: "at", header: "Trocado em", cell: (r) => formatDateTime(r.createdAt) },
    {
      key: "status",
      header: "Situação",
      cell: (r) => (
        <StatusBadge tone={REDEMPTION_STATUS[r.status].tone}>
          {REDEMPTION_STATUS[r.status].label}
        </StatusBadge>
      ),
    },
    ...(canEdit
      ? [
          {
            key: "actions",
            header: <span className="sr-only">Ações</span>,
            numeric: true,
            cell: (r: PrizeRedemption) =>
              r.status === "pending" && (
                <Button
                  size="sm"
                  variant="secondary"
                  loading={deliver.isPending && deliver.variables === r.id}
                  onClick={() =>
                    deliver.mutate(r.id, {
                      onSuccess: () => toast.success(`${r.prize.name} entregue.`),
                      onError: (e) => toast.error(errorMessage(e)),
                    })
                  }
                >
                  Entregar
                </Button>
              ),
          },
        ]
      : []),
  ];

  return (
    <Card>
      <CardHeader
        title="Trocas"
        description="O visitante mostra o código no Centro de Informações. Confira e marque como entregue."
      />
      <div className="mb-4 flex flex-wrap gap-3">
        <SearchInput
          value={code}
          onChange={(v) => {
            setCode(v);
            setPage(1);
          }}
          placeholder="Código"
          label="Buscar pelo código"
        />
        <Select
          aria-label="Situação"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as PrizeRedemptionStatus | "");
            setPage(1);
          }}
          className="w-44"
        >
          <option value="">Todas</option>
          {Object.entries(REDEMPTION_STATUS).map(([value, s]) => (
            <option key={value} value={value}>
              {s.label}
            </option>
          ))}
        </Select>
      </div>
      {list.error ? (
        <ErrorState compact error={list.error} onRetry={() => void list.refetch()} />
      ) : (
        <>
          <Table
            caption="Trocas da lojinha"
            columns={columns}
            rows={list.data?.data}
            rowKey={(r) => r.id}
            loading={list.isLoading}
            skeletonRows={6}
            empty={<EmptyState compact icon={PackageCheck} title="Nenhuma troca aqui" />}
          />
          {list.data && (
            <Pagination meta={list.data.meta} onPageChange={setPage} className="mt-4" />
          )}
        </>
      )}
    </Card>
  );
}

/* Ranking ----------------------------------------------------------------- */

function RankingTab() {
  const ranking = useRanking();
  const columns: Column<RankingEntry>[] = [
    { key: "position", header: "Posição", numeric: true, cell: (r) => `${r.position}º` },
    { key: "nickname", header: "Apelido", cell: (r) => r.nickname },
    { key: "points", header: "Pontos", numeric: true, cell: (r) => formatNumber(r.points) },
  ];
  return (
    <Card>
      <CardHeader
        title="Ranking"
        description="Só quem aceitou participar, só com apelido. Os 100 primeiros."
      />
      {ranking.error ? (
        <ErrorState compact error={ranking.error} onRetry={() => void ranking.refetch()} />
      ) : (
        <Table
          caption="Ranking do Clube ARP"
          columns={columns}
          rows={ranking.data}
          rowKey={(r) => r.nickname}
          loading={ranking.isLoading}
          skeletonRows={8}
          empty={<EmptyState compact icon={Medal} title="Ninguém no ranking ainda" />}
        />
      )}
    </Card>
  );
}

/* Selos por loja ---------------------------------------------------------- */

export function SealsReportTab() {
  const today = todayIso();
  const [from, setFrom] = useState(addDaysIso(today, -29));
  const [to, setTo] = useState(today);
  const report = useSealsReport({ from, to });
  const total = (report.data ?? []).reduce((sum, r) => sum + r.count, 0);

  const columns: Column<SealsReportRow>[] = [
    { key: "store", header: "Loja", cell: (r) => r.store?.name ?? "ARP" },
    {
      key: "challenge",
      header: "Desafio",
      cell: (r) => (
        <span className="flex flex-col">
          <span>{r.challenge.name}</span>
          {r.product && <span className="text-xs text-neutral-500">Produto: {r.product}</span>}
        </span>
      ),
    },
    { key: "seal", header: "Selo", cell: (r) => r.seal.name },
    { key: "count", header: "Selos dados", numeric: true, cell: (r) => formatNumber(r.count) },
  ];

  return (
    <Card>
      <CardHeader
        title="Selos dados por loja e produto"
        description={`Base da cobrança dos parceiros. Total no período: ${formatNumber(total)}.`}
      />
      <FieldRow className="mb-4 max-w-md">
        <Field label="De">
          <Input
            type="date"
            value={from}
            max={to}
            onChange={(e) => e.target.value && setFrom(e.target.value)}
          />
        </Field>
        <Field label="Até">
          <Input
            type="date"
            value={to}
            min={from}
            onChange={(e) => e.target.value && setTo(e.target.value)}
          />
        </Field>
      </FieldRow>
      {report.error ? (
        <ErrorState compact error={report.error} onRetry={() => void report.refetch()} />
      ) : (
        <Table
          caption="Selos dados por loja e produto"
          columns={columns}
          rows={report.data}
          rowKey={(r) => `${r.store?.id ?? "arp"}-${r.challenge.id}`}
          loading={report.isLoading}
          skeletonRows={6}
          empty={<EmptyState compact icon={Store} title="Nenhum selo no período" />}
        />
      )}
    </Card>
  );
}

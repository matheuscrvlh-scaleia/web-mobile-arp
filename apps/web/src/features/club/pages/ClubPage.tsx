import {
  type Permission,
  PRIZE_KIND_LABEL,
  PRIZE_PICKUP_DAYS,
  type Prize,
  type PrizeRedemption,
  type PrizeRedemptionStatus,
  type RankingEntry,
} from "@arp/contracts";
import {
  ArrowRightLeft,
  BookOpen,
  Eye,
  EyeOff,
  Gift,
  Medal,
  PackageCheck,
  Pencil,
  Plus,
  Trash2,
  Undo2,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { useSeals } from "@/features/seals";
import { useAppSettings } from "@/features/settings";
import { useAuth } from "@/shared/auth";
import { PATHS } from "@/shared/config/paths";
import { useDebouncedValue, useSearchParamOption } from "@/shared/hooks";
import { formatDate, formatDateTime, formatNumber, plural } from "@/shared/lib/format";
import { normalize } from "@/shared/lib/text";
import {
  ActionMenu,
  Button,
  ButtonLink,
  Card,
  CardHeader,
  type Column,
  confirmar,
  DemoMark,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  StatusBadge,
  StatusTabs,
  type StatusTone,
  statusTabLabel,
  type TabItem,
  Table,
  TabPanel,
  Tabs,
  toast,
} from "@/shared/ui";
import {
  useCancelRedemption,
  useDeletePrize,
  useDeliverRedemption,
  usePrizes,
  useRanking,
  useRedemptions,
  useSavePrize,
} from "../api";
import { PrizeFormModal } from "../components/PrizeFormModal";

type Tab = "lojinha" | "trocas" | "ranking";
const TABS: (TabItem<Tab> & { permission: Permission | null })[] = [
  { value: "lojinha", label: "Lojinha", icon: Gift, permission: null },
  { value: "trocas", label: "Trocas", icon: PackageCheck, permission: "club.redeem" },
  { value: "ranking", label: "Ranking", icon: Medal, permission: "reports.view" },
];

/** Clube ARP (Fase 2): regras, lojinha, trocas e ranking (cada aba com a sua permissão). */
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
    <div className="min-w-0">
      <PageHeader
        title="Clube ARP"
        description="Selos valem Trevos, que o visitante troca por prêmios no balcão do Centro de Informações. O app mostra a lojinha e o ranking (só apelidos)."
        actions={
          can("club.redeem") && (
            <ButtonLink to={PATHS.prizeExchange} icon={ArrowRightLeft}>
              Trocar Trevos
            </ButtonLink>
          )
        }
      />
      <ClubRulesCard />
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
          <RedemptionsTab />
        ) : (
          <RankingTab />
        )}
      </TabPanel>
    </div>
  );
}

/* Regras ------------------------------------------------------------------ */

/**
 * As regras do Clube num lugar só (antes espalhadas por Selos e
 * Configurações), cada uma com o link para mudar.
 */
function ClubRulesCard() {
  const { can } = useAuth();
  const seals = useSeals({ enabled: can("challenges.view") });
  const settings = useAppSettings({ enabled: can("settings.manage") });
  const active = (seals.data ?? []).filter((s) => s.status === "active");
  const points = active.map((s) => s.points);
  const range = (list: number[], unit: (n: number) => string) => {
    const min = Math.min(...list);
    const max = Math.max(...list);
    return min === max ? unit(min) : `de ${formatNumber(min)} a ${unit(max)}`;
  };
  // Trevos: a validade é escolhida em Configurações (club-points.ts).
  const notice =
    settings.data && settings.data.pointsExpiryNoticeDays > 0
      ? ` O app avisa ${plural(settings.data.pointsExpiryNoticeDays, "dia", "dias")} antes.`
      : "";
  const validity = settings.data
    ? `Os Trevos valem para troca até ${formatDate(`${settings.data.trevosValidUntil}T12:00:00`)}.${notice}`
    : "Os Trevos valem até a data escolhida em Configurações.";

  const rules: { text: string; link?: { to: string; label: string } }[] = [
    {
      text:
        points.length > 0
          ? `Cada conquista de selo dá ${range(points, (n) => plural(n, "Trevo", "Trevos"))}. Selos não vencem: viram histórico.`
          : "Cada conquista de selo dá os Trevos definidos no cadastro do selo.",
      link: can("challenges.view") ? { to: PATHS.seals, label: "Mudar em Selos" } : undefined,
    },
    {
      text: validity,
      link: settings.data
        ? { to: PATHS.settings, label: "Mudar a validade em Configurações" }
        : undefined,
    },
    {
      text: `O visitante troca no app e recebe um código; os Trevos e o prêmio ficam reservados por ${PRIZE_PICKUP_DAYS} dias. No Mercado Local, a equipe valida o código e entrega. Não retirou no prazo? A troca é cancelada e tudo volta.`,
      link: can("club.redeem") ? { to: PATHS.prizeExchange, label: "Validar código" } : undefined,
    },
  ];

  return (
    <Card data-guia="regras" variant="dashed" className="mb-5">
      <CardHeader title="Regras do clube" icon={BookOpen} />
      <ul className="flex flex-col gap-2 text-sm text-neutral-700">
        {rules.map((r) => (
          <li key={r.text} className="flex flex-wrap items-baseline gap-x-2">
            <span className="min-w-0">{r.text}</span>
            {r.link && (
              <Link to={r.link.to} className="text-xs font-medium text-neutral-900 underline">
                {r.link.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* Lojinha ----------------------------------------------------------------- */

// Filtro padrão (R2G-11): situação com contador + busca pelo nome.
type PrizeSituation = "all" | "active" | "soldOut" | "hidden";
const PRIZE_MATCH: Record<PrizeSituation, (p: Prize) => boolean> = {
  all: () => true,
  active: (p) => p.active && p.stock > 0,
  soldOut: (p) => p.active && p.stock <= 0,
  hidden: (p) => !p.active,
};

function PrizesTab({ canEdit }: { canEdit: boolean }) {
  const prizes = usePrizes();
  const remove = useDeletePrize();
  const save = useSavePrize();
  const [editing, setEditing] = useState<Prize | "new" | null>(null);
  const [situation, setSituation] = useState<PrizeSituation>("all");
  const [search, setSearch] = useState("");
  const term = normalize(search.trim());
  const all = prizes.data ?? [];
  const countOf = (s: PrizeSituation) => all.filter(PRIZE_MATCH[s]).length;
  const rows = prizes.data?.filter(
    (p) => PRIZE_MATCH[situation](p) && (!term || normalize(p.name).includes(term)),
  );

  const setActive = (p: Prize, active: boolean) =>
    save.mutate(
      { id: p.id, body: { active } },
      {
        onSuccess: () =>
          toast.success(active ? `${p.name} voltou à lojinha.` : `${p.name} saiu da lojinha.`, {
            action: { label: "Desfazer", onClick: () => setActive(p, !active) },
          }),
        onError: (e) => toast.fromError(e),
      },
    );

  const destroy = async (p: Prize) => {
    const ok = await confirmar({
      title: `Excluir ${p.name}?`,
      description: "O prêmio some de vez. Isso não dá para desfazer.",
      confirmLabel: "Excluir prêmio",
      danger: true,
    });
    if (!ok) return;
    remove.mutate(p.id, {
      onSuccess: () => toast.success(`${p.name} excluído.`),
      onError: (e) => toast.fromError(e),
    });
  };

  const columns: Column<Prize>[] = [
    {
      key: "name",
      header: "Prêmio",
      primary: true,
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
    {
      key: "status",
      header: "App",
      status: true,
      cell: (p) => (
        <StatusBadge tone={p.active && p.stock > 0 ? "success" : "neutral"}>
          {!p.active ? "Fora da lojinha" : p.stock > 0 ? "Na lojinha" : "Esgotado"}
        </StatusBadge>
      ),
    },
    { key: "points", header: "Trevos", numeric: true, cell: (p) => formatNumber(p.points) },
    { key: "stock", header: "Estoque", numeric: true, cell: (p) => formatNumber(p.stock) },
    {
      key: "redeemed",
      header: "Trocados",
      numeric: true,
      cell: (p) => formatNumber(p.redeemedCount),
      hideOnMobile: true,
    },
    {
      key: "enough",
      header: "Já podem trocar",
      numeric: true,
      cell: (p) => formatNumber(p.visitorsEnough),
      hideOnMobile: true,
    },
    {
      key: "almost",
      header: "Perto (80%+)",
      numeric: true,
      cell: (p) => formatNumber(p.visitorsAlmost),
      hideOnMobile: true,
    },
    ...(canEdit
      ? [
          {
            key: "actions",
            header: <span className="sr-only">Ações</span>,
            numeric: true,
            actions: true,
            cell: (p: Prize) => (
              <ActionMenu
                size="sm"
                ariaLabel={`Ações de ${p.name}`}
                items={[
                  { label: "Editar", icon: Pencil, onSelect: () => setEditing(p) },
                  p.active
                    ? {
                        label: "Tirar da lojinha",
                        icon: EyeOff,
                        onSelect: () => setActive(p, false),
                      }
                    : { label: "Voltar à lojinha", icon: Eye, onSelect: () => setActive(p, true) },
                  {
                    label: "Excluir",
                    icon: Trash2,
                    danger: true,
                    onSelect: () => void destroy(p),
                    disabled: p.redeemedCount > 0,
                    hint:
                      p.redeemedCount > 0
                        ? `Já foi trocado ${plural(p.redeemedCount, "vez", "vezes")}: tire da lojinha em vez de excluir`
                        : undefined,
                  },
                ]}
              />
            ),
          },
        ]
      : []),
  ];

  return (
    <Card className="min-w-0">
      <CardHeader
        title="Lojinha"
        description="“Já podem trocar” e “Perto” ajudam a decidir quanto comprar de cada prêmio."
        action={
          canEdit && (
            <Button
              data-guia="criar"
              size="sm"
              variant="secondary"
              icon={Plus}
              onClick={() => setEditing("new")}
            >
              Novo prêmio
            </Button>
          )
        }
      />
      {all.length > 0 && (
        <div className="flex flex-wrap items-start gap-3 px-1 pt-3">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar prêmio"
            label="Buscar prêmio"
            className="w-full sm:w-64"
          />
          <StatusTabs
            value={situation}
            onChange={setSituation}
            className="mb-0"
            options={[
              { value: "all", label: statusTabLabel("all"), count: countOf("all") },
              { value: "active", label: "Na lojinha", count: countOf("active") },
              { value: "soldOut", label: statusTabLabel("soldOut"), count: countOf("soldOut") },
              { value: "hidden", label: "Fora da lojinha", count: countOf("hidden") },
            ]}
          />
        </div>
      )}
      {prizes.error ? (
        <ErrorState compact error={prizes.error} onRetry={() => void prizes.refetch()} />
      ) : (
        <Table
          caption="Prêmios da lojinha"
          columns={columns}
          rows={rows}
          rowKey={(p) => p.id}
          onRowClick={canEdit ? (p) => setEditing(p) : undefined}
          rowLabel={(p) => `Editar ${p.name}`}
          loading={prizes.isLoading}
          skeletonRows={4}
          mobile="cards"
          empty={
            <EmptyState
              compact
              icon={Gift}
              title={all.length > 0 ? "Nenhum prêmio neste filtro" : "Nenhum prêmio ainda"}
            />
          }
        />
      )}
      <PrizeFormModal
        open={editing !== null}
        prize={editing === "new" || editing === null ? undefined : editing}
        onClose={() => setEditing(null)}
      />
    </Card>
  );
}

/* Trocas ------------------------------------------------------------------ */

const REDEMPTION_STATUS: Record<PrizeRedemptionStatus, { label: string; tone: StatusTone }> = {
  pending: { label: "Esperando retirada", tone: "warning" },
  delivered: { label: "Entregue", tone: "success" },
  cancelled: { label: "Desfeita", tone: "neutral" },
};

/**
 * Trocas: as do app esperam retirada no Mercado Local (entregar = validar o
 * código); as do balcão já nascem entregues. Troca errada se desfaz: Trevos e
 * estoque voltam. Mesma permissão do balcão (club.redeem).
 */
function RedemptionsTab() {
  const [status, setStatus] = useState<PrizeRedemptionStatus | "">("");
  const [term, setTerm] = useState("");
  const q = useDebouncedValue(term, 300).trim();
  const [page, setPage] = useState(1);
  const query = {
    page,
    pageSize: 20,
    ...(status ? { status } : {}),
    ...(q ? { q } : {}),
  };
  const list = useRedemptions(query);
  const cancel = useCancelRedemption();
  const deliver = useDeliverRedemption();

  const undo = async (r: PrizeRedemption) => {
    const ok = await confirmar({
      title: `Desfazer a troca de ${r.visitor.name}?`,
      description: `${formatNumber(r.points)} Trevos voltam para ${r.visitor.name} e ${r.prize.name} volta ao estoque.${r.status === "delivered" ? " Recolha o prêmio no balcão." : ""}`,
      confirmLabel: "Desfazer troca",
      cancelLabel: "Manter troca",
      danger: true,
    });
    if (!ok) return;
    cancel.mutate(r.id, {
      onSuccess: () =>
        toast.success(`Troca desfeita: ${r.visitor.name} recebeu os Trevos de volta.`),
      onError: (e) => toast.fromError(e),
    });
  };

  const columns: Column<PrizeRedemption>[] = [
    {
      key: "visitor",
      header: "Visitante",
      primary: true,
      cell: (r) => (
        <span className="inline-flex items-center gap-1.5 font-medium">
          {r.visitor.name}
          <DemoMark show={r.isDemo} />
        </span>
      ),
    },
    {
      key: "status",
      header: "Situação",
      status: true,
      cell: (r) => (
        <StatusBadge tone={REDEMPTION_STATUS[r.status].tone}>
          {REDEMPTION_STATUS[r.status].label}
        </StatusBadge>
      ),
    },
    { key: "prize", header: "Prêmio", cell: (r) => r.prize.name },
    { key: "points", header: "Trevos", numeric: true, cell: (r) => formatNumber(r.points) },
    {
      key: "at",
      header: "Trocado em",
      cell: (r) =>
        r.status === "pending" && r.expiresAt
          ? `${formatDateTime(r.createdAt)} · retirar até ${formatDateTime(r.expiresAt)}`
          : formatDateTime(r.createdAt),
    },
    {
      key: "by",
      header: "Entregue por",
      cell: (r) => <span className="text-neutral-600">{r.deliveredBy?.name ?? "—"}</span>,
      hideOnMobile: true,
    },
    {
      key: "code",
      header: "Código",
      cell: (r) => <span className="font-mono text-xs font-semibold">{r.code}</span>,
      hideOnMobile: true,
    },
    {
      key: "actions",
      header: <span className="sr-only">Ações</span>,
      numeric: true,
      actions: true,
      cell: (r: PrizeRedemption) =>
        r.status === "cancelled" ? null : (
          <span className="inline-flex flex-wrap justify-end gap-2">
            {r.status === "pending" && (
              <Button
                size="sm"
                variant="brand"
                icon={PackageCheck}
                loading={deliver.isPending && deliver.variables === r.id}
                onClick={() =>
                  deliver.mutate(r.id, {
                    onSuccess: () =>
                      toast.success(`Entregue: ${r.prize.name} para ${r.visitor.name}.`),
                    onError: (e) => toast.fromError(e),
                  })
                }
                aria-label={`Entregar ${r.prize.name} para ${r.visitor.name}`}
              >
                Entregar
              </Button>
            )}
            <Button
              data-guia="desfazer-troca"
              size="sm"
              variant="secondary"
              icon={Undo2}
              loading={cancel.isPending && cancel.variables === r.id}
              onClick={() => void undo(r)}
              aria-label={`Desfazer a troca de ${r.prize.name} de ${r.visitor.name}`}
            >
              {r.status === "pending" ? "Cancelar" : "Desfazer troca"}
            </Button>
          </span>
        ),
    },
  ];

  return (
    <Card className="min-w-0">
      <CardHeader
        title="Trocas"
        description="O visitante troca no app e retira no Mercado Local com o código (Esperando retirada → Entregar). No balcão a troca já sai entregue."
        action={
          <ButtonLink to={PATHS.prizeExchange} size="sm" variant="secondary" icon={ArrowRightLeft}>
            Validar código / trocar
          </ButtonLink>
        }
      />
      <div className="mb-4 flex flex-wrap gap-3">
        <SearchInput
          value={term}
          onChange={(v) => {
            setTerm(v);
            setPage(1);
          }}
          placeholder="Visitante ou código"
          label="Buscar troca"
          className="w-full sm:w-72"
        />
        <Select
          aria-label="Situação"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as PrizeRedemptionStatus | "");
            setPage(1);
          }}
          className="w-full sm:w-44"
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
            mobile="cards"
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
    { key: "points", header: "Trevos", numeric: true, cell: (r) => formatNumber(r.points) },
  ];
  return (
    <Card className="min-w-0">
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

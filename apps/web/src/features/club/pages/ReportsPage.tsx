import {
  type CouponsByPromotionRow,
  type CouponsByStoreRow,
  isoDateSchema,
  type SealsReportRow,
} from "@arp/contracts";
import {
  BarChart3,
  Download,
  Percent,
  PiggyBank,
  Smile,
  Store,
  TicketCheck,
  TicketPercent,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import { z } from "zod";
import {
  COUPON_LIFECYCLE,
  type CsvColumn,
  downloadCsv,
  last30Days,
  PeriodFilter,
  previousPeriod,
  useCouponsByPromotion,
} from "@/features/coupons";
import { useCouponsByStore } from "@/features/merchants/api";
import { storeComboboxOptions, useStoreOptions } from "@/features/stores";
import { useAuth } from "@/shared/auth";
import { PATHS } from "@/shared/config/paths";
import { useSearchParamOption, useUrlState } from "@/shared/hooks";
import { formatCents, formatDelta, formatNumber, formatPercent } from "@/shared/lib/format";
import {
  Button,
  Card,
  CardHeader,
  type Column,
  Combobox,
  EmptyState,
  ErrorState,
  KpiCard,
  LifecycleBadge,
  PageHeader,
  type TabItem,
  Table,
  type TableSort,
  TabPanel,
  Tabs,
  toast,
} from "@/shared/ui";
import { useSealsReport } from "../api";
import { NpsTab } from "../components/NpsTab";

type Tab = "promocoes" | "lojas" | "selos" | "nps";
const TABS: TabItem<Tab>[] = [
  { value: "promocoes", label: "Cupons por promoção", icon: TicketPercent },
  { value: "lojas", label: "Cupons por loja", icon: Store },
  { value: "selos", label: "Selos por loja e produto", icon: BarChart3 },
  { value: "nps", label: "NPS do app", icon: Smile },
];

const filtersSchema = z.object({
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  storeId: z.uuid().optional(),
});

const rate = (used: number, claimed: number) => (claimed > 0 ? used / claimed : 0);

/** Ordena no navegador (o relatório vem inteiro). */
function sortRows<T>(rows: T[], sort: TableSort, value: (row: T, key: string) => number | string) {
  const dir = sort.direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = value(a, sort.key);
    const y = value(b, sort.key);
    return (typeof x === "string" ? x.localeCompare(String(y), "pt-BR") : x - Number(y)) * dir;
  });
}

/**
 * Relatórios: qual promoção funcionou melhor (pegos, usados, taxa de uso e
 * economia), o mesmo por loja e os selos dados. Período com atalhos, KPIs
 * contra o período anterior e Exportar CSV do que está na tela.
 */
export function ReportsPage() {
  const { user } = useAuth();
  const merchant = Boolean(user?.store);
  const [tab, setTab] = useSearchParamOption<Tab>(
    "aba",
    TABS.map((t) => t.value),
    "promocoes",
  );
  const [filters, setFilters] = useUrlState(filtersSchema);
  const fallback = useMemo(() => last30Days(), []);
  const period = {
    from: filters.from ?? fallback.from,
    to: filters.to ?? fallback.to,
  };
  const previous = previousPeriod(period);
  const stores = useStoreOptions({ enabled: !merchant });
  const storeOptions = useMemo(() => storeComboboxOptions(stores.data ?? []), [stores.data]);

  const byPromotion = useCouponsByPromotion({ ...period, storeId: filters.storeId });
  const before = useCouponsByPromotion({ ...previous, storeId: filters.storeId });
  const byStore = useCouponsByStore({ ...period, storeId: filters.storeId });
  const seals = useSealsReport({ ...period, storeId: filters.storeId });

  const sum = (rows: CouponsByPromotionRow[] | undefined) => {
    const t = { claimed: 0, used: 0, savings: 0 };
    for (const r of rows ?? []) {
      t.claimed += r.claimed;
      t.used += r.used;
      t.savings += r.savingsCents ?? 0;
    }
    return t;
  };
  const now = sum(byPromotion.data);
  const prev = before.data ? sum(before.data) : null;

  // A API já limita à loja do filtro (e à do lojista).
  const storeRows = byStore.data ?? [];

  const exportCsv = () => {
    const name = `${period.from}_a_${period.to}`;
    if (tab === "promocoes") {
      if (!byPromotion.data?.length) return toast.info("Nada para exportar neste período.");
      downloadCsv(`cupons-por-promocao-${name}.csv`, byPromotion.data, PROMOTION_CSV);
    } else if (tab === "lojas") {
      if (!storeRows.length) return toast.info("Nada para exportar neste período.");
      downloadCsv(`cupons-por-loja-${name}.csv`, storeRows, STORE_CSV);
    } else if (tab === "nps") {
      return toast.info("O NPS ainda não exporta CSV: copie da tabela.");
    } else {
      if (!seals.data?.length) return toast.info("Nada para exportar neste período.");
      downloadCsv(`selos-por-loja-${name}.csv`, seals.data, SEALS_CSV);
    }
  };

  return (
    <>
      <PageHeader
        title="Relatórios"
        description="Qual promoção funcionou melhor, cupons por loja, selos dados e o NPS do app no período."
        actions={
          <Button variant="secondary" icon={Download} onClick={exportCsv}>
            Exportar CSV
          </Button>
        }
      />
      <div data-guia="filtros" className="mb-4 flex flex-wrap items-center gap-2">
        <PeriodFilter value={period} onChange={(p) => setFilters({ from: p.from, to: p.to })} />
        {!merchant && (
          <Combobox
            aria-label="Loja"
            placeholder="Todas as lojas"
            emptyText="Nenhuma loja com esse nome"
            options={storeOptions}
            loading={stores.isLoading}
            value={filters.storeId ?? null}
            onChange={(v) => setFilters({ storeId: v ?? undefined })}
            className="w-full sm:w-56"
          />
        )}
      </div>

      {tab !== "selos" && tab !== "nps" && (
        <div data-guia="cartoes" className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard
            label="Cupons pegos"
            icon={Wallet}
            value={formatNumber(now.claimed)}
            delta={formatDelta(now.claimed, prev?.claimed ?? null)}
          />
          <KpiCard
            label="Cupons usados"
            icon={TicketCheck}
            value={formatNumber(now.used)}
            delta={formatDelta(now.used, prev?.used ?? null)}
          />
          <KpiCard
            label="Taxa de uso"
            icon={Percent}
            value={formatPercent(rate(now.used, now.claimed))}
            hint="Usados ÷ pegos"
            delta={formatDelta(
              rate(now.used, now.claimed),
              prev ? rate(prev.used, prev.claimed) : null,
              "points",
            )}
          />
          <KpiCard
            label="Economia gerada"
            icon={PiggyBank}
            value={formatCents(now.savings, { whole: true })}
            hint="Usados × economia por uso"
            delta={formatDelta(now.savings, prev?.savings ?? null)}
          />
        </div>
      )}

      <Tabs
        idBase="relatorios"
        label="Relatórios"
        items={merchant ? TABS.filter((t) => t.value !== "nps") : TABS}
        value={tab}
        onChange={setTab}
        className="mb-5"
      />
      <TabPanel idBase="relatorios" value={tab}>
        {tab === "promocoes" ? (
          <PromotionsTab query={byPromotion} />
        ) : tab === "lojas" ? (
          <StoresTab
            rows={storeRows}
            loading={byStore.isLoading}
            error={byStore.error}
            retry={() => void byStore.refetch()}
          />
        ) : tab === "nps" ? (
          <NpsTab period={period} />
        ) : (
          <SealsTab
            rows={seals.data}
            loading={seals.isLoading}
            error={seals.error}
            retry={() => void seals.refetch()}
          />
        )}
      </TabPanel>
    </>
  );
}

/* Por promoção ------------------------------------------------------------- */

const PROMOTION_CSV: CsvColumn<CouponsByPromotionRow>[] = [
  { header: "Promoção", value: (r) => r.coupon.title },
  { header: "Destaque", value: (r) => r.coupon.headline },
  { header: "Loja", value: (r) => r.store.name },
  { header: "Situação", value: (r) => COUPON_LIFECYCLE[r.lifecycle].label },
  { header: "Liberados", value: (r) => r.total },
  { header: "Pegos", value: (r) => r.claimed },
  { header: "Usados", value: (r) => r.used },
  { header: "Taxa de uso (%)", value: (r) => Math.round(rate(r.used, r.claimed) * 1000) / 10 },
  { header: "Voltaram", value: (r) => r.returned },
  {
    header: "Economia gerada (R$)",
    value: (r) => (r.savingsCents === null ? null : r.savingsCents / 100),
  },
];

function PromotionsTab({ query }: { query: ReturnType<typeof useCouponsByPromotion> }) {
  const [sort, setSort] = useState<TableSort>({ key: "used", direction: "desc" });
  const rows = useMemo(
    () =>
      sortRows(query.data ?? [], sort, (r, key) => {
        switch (key) {
          case "title":
            return r.coupon.title;
          case "claimed":
            return r.claimed;
          case "rate":
            return rate(r.used, r.claimed);
          case "returned":
            return r.returned;
          case "savings":
            return r.savingsCents ?? -1;
          default:
            return r.used;
        }
      }),
    [query.data, sort],
  );
  const columns: Column<CouponsByPromotionRow>[] = [
    {
      key: "title",
      header: "Promoção",
      primary: true,
      sortable: true,
      cell: (r) => (
        <span className="flex flex-col">
          <span className="max-w-72 truncate font-medium">{r.coupon.title}</span>
          <span className="text-xs text-neutral-500">
            {r.coupon.headline} · {r.store.name}
          </span>
        </span>
      ),
    },
    {
      key: "status",
      header: "Situação",
      status: true,
      cell: (r) => (
        <LifecycleBadge
          status={COUPON_LIFECYCLE[r.lifecycle].badge}
          label={COUPON_LIFECYCLE[r.lifecycle].label}
        />
      ),
      className: "hidden md:table-cell",
    },
    {
      key: "claimed",
      header: "Pegos",
      numeric: true,
      sortable: true,
      cell: (r) => formatNumber(r.claimed),
    },
    {
      key: "used",
      header: "Usados",
      numeric: true,
      sortable: true,
      cell: (r) => formatNumber(r.used),
    },
    {
      key: "rate",
      header: "Taxa de uso",
      numeric: true,
      sortable: true,
      cell: (r) => (r.claimed > 0 ? formatPercent(rate(r.used, r.claimed)) : "—"),
    },
    {
      key: "returned",
      header: "Voltaram",
      numeric: true,
      sortable: true,
      cell: (r) => formatNumber(r.returned),
      className: "hidden lg:table-cell",
    },
    {
      key: "savings",
      header: "Economia",
      numeric: true,
      sortable: true,
      cell: (r) => (r.savingsCents === null ? "—" : formatCents(r.savingsCents)),
    },
  ];
  return (
    <Card>
      <CardHeader
        title="Cupons por promoção"
        description="Clique no título da coluna para ordenar. Taxa de uso = usados ÷ pegos no período."
      />
      {query.error ? (
        <ErrorState compact error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <Table
          caption="Cupons por promoção"
          columns={columns}
          rows={query.data ? rows : undefined}
          rowKey={(r) => r.coupon.id}
          rowHref={(r) => PATHS.coupon(r.coupon.id)}
          loading={query.isLoading}
          skeletonRows={6}
          mobile="cards"
          sort={sort}
          onSortChange={setSort}
          empty={
            <EmptyState
              compact
              icon={TicketPercent}
              title="Nenhum cupom pego ou usado no período"
            />
          }
        />
      )}
    </Card>
  );
}

/* Por loja ------------------------------------------------------------------ */

const STORE_CSV: CsvColumn<CouponsByStoreRow>[] = [
  { header: "Loja", value: (r) => r.store.name },
  { header: "Pegos", value: (r) => r.claimed },
  { header: "Usados", value: (r) => r.used },
  { header: "Taxa de uso (%)", value: (r) => Math.round(rate(r.used, r.claimed) * 1000) / 10 },
];

function StoresTab({
  rows,
  loading,
  error,
  retry,
}: {
  rows: CouponsByStoreRow[];
  loading: boolean;
  error: unknown;
  retry: () => void;
}) {
  const [sort, setSort] = useState<TableSort>({ key: "used", direction: "desc" });
  const sorted = useMemo(
    () =>
      sortRows(rows, sort, (r, key) =>
        key === "store"
          ? r.store.name
          : key === "claimed"
            ? r.claimed
            : key === "rate"
              ? rate(r.used, r.claimed)
              : r.used,
      ),
    [rows, sort],
  );
  const columns: Column<CouponsByStoreRow>[] = [
    { key: "store", header: "Loja", primary: true, sortable: true, cell: (r) => r.store.name },
    {
      key: "claimed",
      header: "Pegos",
      numeric: true,
      sortable: true,
      cell: (r) => formatNumber(r.claimed),
    },
    {
      key: "used",
      header: "Usados",
      numeric: true,
      sortable: true,
      cell: (r) => formatNumber(r.used),
    },
    {
      key: "rate",
      header: "Taxa de uso",
      numeric: true,
      sortable: true,
      cell: (r) => (r.claimed > 0 ? formatPercent(rate(r.used, r.claimed)) : "—"),
    },
  ];
  return (
    <Card>
      <CardHeader
        title="Cupons por loja"
        description="Pegos e usados de todas as promoções da loja."
      />
      {error ? (
        <ErrorState compact error={error} onRetry={retry} />
      ) : (
        <Table
          caption="Cupons por loja"
          columns={columns}
          rows={loading ? undefined : sorted}
          rowKey={(r) => r.store.id}
          loading={loading}
          skeletonRows={6}
          mobile="cards"
          sort={sort}
          onSortChange={setSort}
          empty={<EmptyState compact icon={TicketPercent} title="Nenhum cupom no período" />}
        />
      )}
    </Card>
  );
}

/* Selos --------------------------------------------------------------------- */

const SEALS_CSV: CsvColumn<SealsReportRow>[] = [
  { header: "Loja", value: (r) => r.store?.name ?? "ARP" },
  { header: "Desafio", value: (r) => r.challenge.name },
  { header: "Produto", value: (r) => r.product ?? "" },
  { header: "Selo", value: (r) => r.seal.name },
  { header: "Selos dados", value: (r) => r.count },
];

function SealsTab({
  rows,
  loading,
  error,
  retry,
}: {
  rows: SealsReportRow[] | undefined;
  loading: boolean;
  error: unknown;
  retry: () => void;
}) {
  const total = (rows ?? []).reduce((n, r) => n + r.count, 0);
  const columns: Column<SealsReportRow>[] = [
    { key: "store", header: "Loja", cell: (r) => r.store?.name ?? "ARP" },
    {
      key: "challenge",
      header: "Desafio",
      primary: true,
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
      {error ? (
        <ErrorState compact error={error} onRetry={retry} />
      ) : (
        <Table
          caption="Selos dados por loja e produto"
          columns={columns}
          rows={rows}
          rowKey={(r) => `${r.store?.id ?? "arp"}-${r.challenge.id}-${r.seal.id}`}
          loading={loading}
          skeletonRows={6}
          mobile="cards"
          empty={<EmptyState compact icon={Store} title="Nenhum selo no período" />}
        />
      )}
    </Card>
  );
}

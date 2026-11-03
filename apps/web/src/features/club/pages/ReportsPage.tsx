import type { CouponsByStoreRow } from "@arp/contracts";
import { BarChart3, TicketPercent } from "lucide-react";
import { useState } from "react";
import { useCouponsByStore } from "@/features/merchants/api";
import { useSearchParamOption } from "@/shared/hooks";
import { addDaysIso, todayIso } from "@/shared/lib/dates";
import { formatNumber } from "@/shared/lib/format";
import {
  Card,
  CardHeader,
  type Column,
  EmptyState,
  ErrorState,
  Field,
  FieldRow,
  Input,
  PageHeader,
  type TabItem,
  Table,
  TabPanel,
  Tabs,
} from "@/shared/ui";
import { SealsReportTab } from "./ClubPage";

type Tab = "cupons" | "selos";
const TABS: TabItem<Tab>[] = [
  { value: "cupons", label: "Cupons por loja", icon: TicketPercent },
  { value: "selos", label: "Selos por loja e produto", icon: BarChart3 },
];

/** Relatórios (Fase 2): cupons usados e selos dados por loja. */
export function ReportsPage() {
  const [tab, setTab] = useSearchParamOption<Tab>("aba", ["cupons", "selos"], "cupons");
  return (
    <>
      <PageHeader
        title="Relatórios"
        description="Cupons usados e selos dados por loja e produto no período."
      />
      <Tabs
        idBase="relatorios"
        label="Relatórios"
        items={TABS}
        value={tab}
        onChange={setTab}
        className="mb-5"
      />
      <TabPanel idBase="relatorios" value={tab}>
        {tab === "cupons" ? <CouponsTab /> : <SealsReportTab />}
      </TabPanel>
    </>
  );
}

function CouponsTab() {
  const today = todayIso();
  const [from, setFrom] = useState(addDaysIso(today, -29));
  const [to, setTo] = useState(today);
  const report = useCouponsByStore({ from, to });
  const used = (report.data ?? []).reduce((sum, r) => sum + r.used, 0);
  const columns: Column<CouponsByStoreRow>[] = [
    { key: "store", header: "Loja", cell: (r) => r.store.name },
    { key: "claimed", header: "Pegos", numeric: true, cell: (r) => formatNumber(r.claimed) },
    { key: "used", header: "Usados", numeric: true, cell: (r) => formatNumber(r.used) },
  ];
  return (
    <Card>
      <CardHeader
        title="Cupons usados por loja"
        description={`Total usado no período: ${formatNumber(used)}.`}
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
          caption="Cupons usados por loja"
          columns={columns}
          rows={report.data}
          rowKey={(r) => r.store.id}
          loading={report.isLoading}
          skeletonRows={6}
          empty={<EmptyState compact icon={TicketPercent} title="Nenhum cupom no período" />}
        />
      )}
    </Card>
  );
}

import { type NpsResponse, npsReportSchema, ROUTES } from "@arp/contracts";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Frown, Meh, Smile, ThumbsUp } from "lucide-react";
import { useState } from "react";
import { apiRequest } from "@/shared/api";
import { formatDateTime, formatNumber, formatPercent } from "@/shared/lib/format";
import {
  Card,
  CardHeader,
  type Column,
  EmptyState,
  ErrorState,
  KpiCard,
  Pagination,
  StatusBadge,
  Table,
} from "@/shared/ui";

const PAGE_SIZE = 20;

/** 9–10 promotor, 7–8 neutro, 0–6 detrator. */
function band(score: number) {
  if (score >= 9) return { label: "Promotor", tone: "success" } as const;
  if (score >= 7) return { label: "Neutro", tone: "neutral" } as const;
  return { label: "Detrator", tone: "danger" } as const;
}

/** NPS do app: a nota de "quanto recomendaria a ARP" no período e as respostas. */
export function NpsTab({ period }: { period: { from: string; to: string } }) {
  const [page, setPage] = useState(1);
  const query = { ...period, page, pageSize: PAGE_SIZE };
  const report = useQuery({
    queryKey: ["reports", "nps", query],
    queryFn: ({ signal }) => apiRequest(ROUTES.clubReports.nps, npsReportSchema, { query, signal }),
    placeholderData: keepPreviousData,
  });
  const s = report.data?.summary;
  const share = (n: number) => (s && s.total > 0 ? n / s.total : 0);

  const columns: Column<NpsResponse>[] = [
    {
      key: "score",
      header: "Nota",
      numeric: true,
      primary: true,
      cell: (r) => <span className="font-semibold tabular-nums">{r.score}</span>,
    },
    {
      key: "band",
      header: "Tipo",
      status: true,
      cell: (r) => <StatusBadge tone={band(r.score).tone}>{band(r.score).label}</StatusBadge>,
    },
    {
      key: "comment",
      header: "Comentário",
      cell: (r) => <span className="text-neutral-700">{r.comment || "—"}</span>,
    },
    {
      key: "visitor",
      header: "Visitante",
      cell: (r) => r.visitor?.name ?? "—",
      hideOnMobile: true,
    },
    { key: "at", header: "Respondido em", cell: (r) => formatDateTime(r.createdAt) },
  ];

  return (
    <>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="NPS"
          icon={ThumbsUp}
          value={s?.nps == null ? "—" : formatNumber(s.nps)}
          hint="% promotores − % detratores (−100 a 100)"
        />
        <KpiCard
          label="Promotores (9–10)"
          icon={Smile}
          value={s ? formatNumber(s.promoters) : "—"}
          hint={s ? formatPercent(share(s.promoters)) : undefined}
        />
        <KpiCard
          label="Neutros (7–8)"
          icon={Meh}
          value={s ? formatNumber(s.passives) : "—"}
          hint={s ? formatPercent(share(s.passives)) : undefined}
        />
        <KpiCard
          label="Detratores (0–6)"
          icon={Frown}
          value={s ? formatNumber(s.detractors) : "—"}
          hint={s ? formatPercent(share(s.detractors)) : undefined}
        />
      </div>
      <Card className="min-w-0">
        <CardHeader
          title="Respostas do NPS"
          description="O app pergunta “De 0 a 10, quanto você recomendaria a ARP?” a quem usa o app há alguns dias, no máximo a cada 4 meses."
        />
        {report.error ? (
          <ErrorState compact error={report.error} onRetry={() => void report.refetch()} />
        ) : (
          <>
            <Table
              caption="Respostas do NPS"
              columns={columns}
              rows={report.data?.data}
              rowKey={(r) => r.id}
              loading={report.isLoading}
              skeletonRows={6}
              mobile="cards"
              empty={<EmptyState compact icon={Smile} title="Nenhuma resposta no período" />}
            />
            {report.data && (
              <Pagination meta={report.data.meta} onPageChange={setPage} className="mt-4" />
            )}
          </>
        )}
      </Card>
    </>
  );
}

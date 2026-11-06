import type { DashboardOverview } from "@arp/contracts";
import { formatDateShort, formatIsoDay } from "@/shared/lib/format";
import type { SeriesDef } from "@/shared/ui/charts";
import { LineSeriesChart } from "@/shared/ui/charts/LineSeriesChart";

type DailyRow = DashboardOverview["daily"][number];

// Cor presa à métrica (nunca à posição), igual em todas as telas.
const DAILY_SERIES: SeriesDef<Exclude<keyof DailyRow, "date">>[] = [
  { key: "claims", label: "Cupons pegos", color: 1 },
  { key: "redemptions", label: "Cupons usados", color: 3 },
  { key: "signups", label: "Cadastros", color: 2 },
  { key: "seals", label: "Selos", color: 4 },
];

/** "2026-10-31" → data ao meio-dia UTC (cai no mesmo dia em Brasília). */
const dayTitle = (iso: string) => formatDateShort(`${iso}T12:00:00Z`);

/**
 * Movimento por dia (recharts). Fica num módulo próprio para a tela abrir
 * com os indicadores enquanto a biblioteca de gráficos ainda chega.
 */
export function DailyChart({ data, store = false }: { data: DailyRow[]; store?: boolean }) {
  // Com loja, "cadastros" são os clientes novos da loja (1º cupom pego nela).
  const series = store
    ? DAILY_SERIES.map((s) => (s.key === "signups" ? { ...s, label: "Novos clientes" } : s))
    : DAILY_SERIES;
  return (
    <LineSeriesChart
      data={data}
      xKey="date"
      series={series}
      formatX={(d) => formatIsoDay(String(d))}
      formatTitle={(d) => dayTitle(String(d))}
      description="Cupons pegos, cupons usados, cadastros e selos por dia"
    />
  );
}

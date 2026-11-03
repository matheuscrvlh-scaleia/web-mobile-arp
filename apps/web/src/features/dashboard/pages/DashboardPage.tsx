import { type DashboardPeriod, dashboardQuerySchema } from "@arp/contracts";
import { CircleCheck, CircleX, Clock4, Copy, LineChart, Loader, QrCode } from "lucide-react";
import { lazy, Suspense } from "react";
import { useStoreOptions } from "@/features/stores";
import { useAuth } from "@/shared/auth";
import { useDocumentTitle, useUrlState } from "@/shared/hooks";
import { formatNumber } from "@/shared/lib/format";
import {
  Card,
  CardHeader,
  ErrorState,
  LoadingRegion,
  Segmented,
  Select,
  Skeleton,
  SkeletonGrid,
} from "@/shared/ui";
import { HourBars, ProportionBar } from "@/shared/ui/charts";
import { useDashboardOverview } from "../api";
import { DashboardKpis } from "../components/DashboardKpis";
import {
  SealsByChallengeCard,
  TopCouponsCard,
  TopStoresCard,
} from "../components/DashboardRankings";
import { WelcomeBanner } from "../components/WelcomeBanner";

const PERIODS: { value: DashboardPeriod; label: string }[] = [
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "90d", label: "90 dias" },
];
const PERIOD_TEXT: Record<DashboardPeriod, string> = {
  "7d": "7 dias",
  "30d": "30 dias",
  "90d": "90 dias",
};

// O gráfico de linhas (recharts, ~100 kB) começa a baixar junto com a tela,
// mas não segura os indicadores: aparece quando chega.
const loadDailyChart = () => import("../components/DailyChart");
const DailyChart = lazy(() => loadDailyChart().then((m) => ({ default: m.DailyChart })));
void loadDailyChart();

export function DashboardPage() {
  const { user } = useAuth();
  const merchant = Boolean(user?.store);
  const [query, setQuery] = useUrlState(dashboardQuerySchema);
  const overview = useDashboardOverview(query);
  const stores = useStoreOptions({ enabled: !merchant });
  const data = overview.data;
  useDocumentTitle("Dashboard");

  return (
    <>
      <WelcomeBanner
        eyebrow={`Dashboard · ${user?.store?.name ?? "App ARP"}`}
        name={user?.name.split(/\s+/)[0] ?? ""}
      >
        {merchant
          ? `Como a ${user?.store?.name} está indo no app.`
          : "Como o app está sendo usado: cadastros, cupons, selos e leituras de QR."}
      </WelcomeBanner>
      <div className="mt-5 mb-6 flex flex-wrap items-center justify-end gap-2">
        {/* Trocou loja ou período: os números antigos ficam até os novos chegarem. */}
        {overview.isPlaceholderData && (
          <span className="flex items-center gap-1.5 px-3 text-xs text-neutral-500">
            <Loader className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden />
            Atualizando…
          </span>
        )}
        {!merchant && (
          <Select
            aria-label="Loja"
            placeholder="Todas as lojas"
            value={query.storeId ?? ""}
            onChange={(e) => setQuery({ storeId: e.target.value || undefined })}
            className="w-52"
          >
            {(stores.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        )}
        <Segmented
          label="Período"
          options={PERIODS}
          value={query.period}
          onChange={(period) => setQuery({ period: period === "30d" ? undefined : period })}
        />
      </div>

      {overview.error && !data ? (
        <Card>
          <ErrorState error={overview.error} onRetry={() => void overview.refetch()} />
        </Card>
      ) : !data ? (
        <LoadingRegion label="Carregando indicadores…">
          <SkeletonGrid count={4} itemClassName="h-40" />
          <SkeletonGrid
            count={5}
            className="sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5"
            itemClassName="h-40"
          />
          <Skeleton className="h-96 rounded-[1.75rem]" />
        </LoadingRegion>
      ) : (
        <div className="flex flex-col gap-5" aria-busy={overview.isFetching || undefined}>
          <DashboardKpis kpis={data.kpis} periodLabel={PERIOD_TEXT[data.period]} />

          <Card>
            <CardHeader
              title="Movimento por dia"
              description={`Últimos ${PERIOD_TEXT[data.period]}, no horário de Brasília`}
              icon={LineChart}
            />
            {data.daily.length === 0 ? (
              <p className="py-10 text-center text-sm text-neutral-500">Sem dados no período.</p>
            ) : (
              <Suspense fallback={<Skeleton className="h-[260px] rounded-2xl" />}>
                <DailyChart data={data.daily} />
              </Suspense>
            )}
          </Card>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <Card>
              <CardHeader
                title="Usos por hora"
                description="Quando os cupons são validados no caixa"
              />
              <HourBars data={data.redemptionsByHour} description="Cupons usados por hora do dia" />
            </Card>
            <Card>
              <CardHeader
                title="Leituras de QR Code"
                description={`${formatNumber(
                  data.scanOutcomes.awarded +
                    data.scanOutcomes.duplicate +
                    data.scanOutcomes.expired +
                    data.scanOutcomes.invalid,
                )} leituras no período`}
                icon={QrCode}
              />
              <ProportionBar
                label="Resultado das leituras de QR Code"
                formatValue={(v) => formatNumber(v)}
                segments={[
                  {
                    key: "awarded",
                    label: "Selo dado",
                    value: data.scanOutcomes.awarded,
                    color: 3,
                    icon: CircleCheck,
                  },
                  {
                    key: "duplicate",
                    label: "Já tinha o selo",
                    value: data.scanOutcomes.duplicate,
                    color: 1,
                    icon: Copy,
                  },
                  {
                    key: "expired",
                    label: "QR vencido",
                    value: data.scanOutcomes.expired,
                    color: 4,
                    icon: Clock4,
                  },
                  {
                    key: "invalid",
                    label: "QR inválido",
                    value: data.scanOutcomes.invalid,
                    color: 2,
                    icon: CircleX,
                  },
                ]}
              />
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            {!merchant && <TopStoresCard items={data.topStores} />}
            <TopCouponsCard items={data.topCoupons} />
            <SealsByChallengeCard items={data.sealsByChallenge} />
          </div>
        </div>
      )}
    </>
  );
}

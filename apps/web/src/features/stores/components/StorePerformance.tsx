import type { MetricsPeriod, StoreMetrics } from "@arp/contracts";
import { BellRing, Heart, History, Radio, TicketPercent } from "lucide-react";
import { useSearchParamOption } from "@/shared/hooks";
import { cn } from "@/shared/lib/cn";
import { formatDateTime, formatNumber, formatRelative, plural } from "@/shared/lib/format";
import {
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  LoadingRegion,
  Segmented,
  Skeleton,
  SkeletonGrid,
} from "@/shared/ui";
import { HourBars } from "@/shared/ui/charts";
import { useStoreMetrics } from "../api";

const PERIODS: { value: MetricsPeriod; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "90d", label: "90 dias" },
];
const PERIOD_VALUES = PERIODS.map((p) => p.value);

/** Painel do lojista (como no app): o que a loja ganhou com os cupons e o app. */
export function StorePerformance({ storeId }: { storeId: string }) {
  const [period, setPeriod] = useSearchParamOption("periodo", PERIOD_VALUES, "30d");
  const metrics = useStoreMetrics(storeId, period);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented label="Período" options={PERIODS} value={period} onChange={setPeriod} />
        {metrics.isFetching && !metrics.isLoading && (
          <span className="text-xs text-neutral-500" aria-live="polite">
            Atualizando…
          </span>
        )}
      </div>
      {metrics.error ? (
        <Card>
          <ErrorState error={metrics.error} onRetry={() => void metrics.refetch()} />
        </Card>
      ) : !metrics.data ? (
        <LoadingRegion>
          <SkeletonGrid count={3} className="lg:grid-cols-[2fr_1fr_1fr]" itemClassName="h-52" />
          <Skeleton className="h-40 rounded-[1.75rem]" />
        </LoadingRegion>
      ) : (
        <MetricsView data={metrics.data} />
      )}
    </div>
  );
}

function MetricsView({ data }: { data: StoreMetrics }) {
  const { coupons } = data;
  return (
    <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr_1fr]">
        <Card variant="dark" padding="lg">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgb(255_255_255/0.1)] px-2.5 py-1 text-xs font-medium text-neutral-700">
            <Radio className="size-3.5 text-marca" aria-hidden />
            Cupons no período
          </span>
          <p className="mt-5 flex flex-wrap items-baseline gap-x-3">
            <span className="text-5xl font-semibold tracking-tight tabular-nums">
              {formatNumber(coupons.redeemed)}
            </span>
            <span className="text-sm text-neutral-500">
              usados de {plural(coupons.released, "liberado", "liberados")}
            </span>
          </p>
          <hr className="my-5 border-dashed border-neutral-300" />
          <dl className="grid grid-cols-3 gap-3">
            <Stat label="pegos" value={coupons.claimed} />
            <Stat label="aguardando uso" value={coupons.waiting} />
            <Stat label="voltaram" value={coupons.returned} />
          </dl>
        </Card>
        <Card variant="green" className="flex flex-col justify-between gap-6">
          <BellRing className="size-6" aria-hidden />
          <div>
            <p className="text-4xl font-semibold tracking-tight tabular-nums">
              {formatNumber(data.followersCount)}
            </p>
            <p className="text-sm text-neutral-700">pedem aviso de ofertas</p>
          </div>
        </Card>
        <Card className="flex flex-col justify-between gap-6">
          <Heart className="size-6 text-neutral-500" aria-hidden />
          <div>
            <p className="text-4xl font-semibold tracking-tight tabular-nums">
              {formatNumber(data.favoritesCount)}
            </p>
            <p className="text-sm text-neutral-500">favoritaram a loja</p>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title={`Os ${formatNumber(coupons.released)} cupons liberados`}
          description="Cada quadrado é um cupom. Nunca passa do estoque das promoções ativas."
        />
        <StockGrid metrics={data} />
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Usos por hora"
            description="Quando os clientes validam os cupons no caixa."
          />
          <HourBars data={data.redemptionsByHour} description="Cupons usados por hora do dia" />
        </Card>
        <Card>
          <CardHeader title="Últimos usos" icon={History} />
          {data.lastRedemptions.length === 0 ? (
            <EmptyState
              compact
              icon={TicketPercent}
              title="Nenhum cupom usado no período"
              description="Os códigos validados no caixa aparecem aqui."
            />
          ) : (
            <ul className="flex flex-col divide-y divide-neutral-900/[0.06]">
              {data.lastRedemptions.map((r) => (
                <li key={`${r.code}-${r.redeemedAt}`} className="flex items-center gap-3 py-2.5">
                  <code className="rounded-lg bg-neutral-900/[0.06] px-2 py-1 font-mono text-xs font-semibold">
                    {r.code}
                  </code>
                  <span className="min-w-0 flex-1 truncate text-sm text-neutral-700">
                    {r.couponTitle}
                  </span>
                  <time
                    dateTime={r.redeemedAt}
                    title={formatDateTime(r.redeemedAt)}
                    className="shrink-0 text-xs text-neutral-500"
                  >
                    {formatRelative(r.redeemedAt)}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="sr-only">{label}</dt>
      <dd>
        <span className="block text-2xl font-semibold tabular-nums">{formatNumber(value)}</span>
        <span aria-hidden className="text-xs text-neutral-500">
          {label}
        </span>
      </dd>
    </div>
  );
}

const MAX_SQUARES = 300;
const LEGEND = [
  { key: "usado", label: "Usado", className: "estoque-usado" },
  { key: "aguardando", label: "Aguardando uso", className: "estoque-aguardando" },
  { key: "voltou", label: "Voltou", className: "estoque-voltou" },
  { key: "livre", label: "Livre", className: "estoque-livre" },
] as const;

/** Estoque em quadradinhos (com muitos cupons, cada quadrado vale mais de um). */
function StockGrid({ metrics }: { metrics: StoreMetrics }) {
  const { released, redeemed, waiting, returned } = metrics.coupons;
  if (released === 0) {
    return (
      <p className="py-6 text-center text-sm text-neutral-500">
        Nenhuma promoção ativa com estoque agora.
      </p>
    );
  }
  const per = Math.max(1, Math.ceil(released / MAX_SQUARES));
  const n = (v: number) => Math.round(v / per);
  const total = Math.ceil(released / per);
  const used = Math.min(n(redeemed), total);
  const wait = Math.min(n(waiting), total - used);
  const back = Math.min(n(returned), total - used - wait);
  const kinds = Array.from({ length: total }, (_, i) =>
    i < used ? 0 : i < used + wait ? 1 : i < used + wait + back ? 2 : 3,
  );
  const free = Math.max(0, released - redeemed - waiting - returned);
  const values = [redeemed, waiting, returned, free];
  return (
    <figure>
      <div
        aria-hidden
        className={cn(
          "grid gap-1",
          total > 60
            ? "grid-cols-[repeat(auto-fill,minmax(0.75rem,1fr))]"
            : "grid-cols-[repeat(auto-fill,minmax(1.4rem,1fr))]",
        )}
      >
        {kinds.map((k, i) => (
          <i
            // biome-ignore lint/suspicious/noArrayIndexKey: quadrados sem identidade própria
            key={i}
            className={cn("block rounded-[5px]", total > 60 ? "h-3" : "h-6", LEGEND[k]?.className)}
          />
        ))}
      </div>
      <figcaption className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-neutral-600">
        {LEGEND.map((l, i) => (
          <span key={l.key} className="flex items-center gap-1.5">
            <i aria-hidden className={cn("size-3 rounded-[3px]", l.className)} />
            {l.label}: <b className="font-semibold tabular-nums">{formatNumber(values[i] ?? 0)}</b>
          </span>
        ))}
        {per > 1 && <span className="text-neutral-400">Cada quadrado ≈ {per} cupons</span>}
      </figcaption>
    </figure>
  );
}

import type { DashboardOverview } from "@arp/contracts";
import { Award, Store, TicketPercent } from "lucide-react";
import { useAuth } from "@/shared/auth";
import { PATHS } from "@/shared/config/paths";
import { formatNumber, plural } from "@/shared/lib/format";
import { Card, CardHeader, DEMO_MIXED_HINT, DemoMark, SealIcon, StatusBadge } from "@/shared/ui";
import { BarList } from "@/shared/ui/charts";

export function TopStoresCard({
  items,
  demo = false,
}: {
  items: DashboardOverview["topStores"];
  /** Há dados fictícios somando. */
  demo?: boolean;
}) {
  const { can } = useAuth();
  return (
    <Card>
      <CardHeader
        title={
          <>
            Lojas que mais movimentam <DemoMark show={demo} hint={DEMO_MIXED_HINT} />
          </>
        }
        description="Cupons pegos no período"
        icon={Store}
      />
      <BarList
        label="Lojas com mais cupons pegos"
        emptyText="Nenhum cupom pego no período."
        items={items.map((t) => ({
          key: t.store.id,
          label: t.store.name,
          value: t.claims,
          valueText: formatNumber(t.claims),
          sublabel: `${plural(t.redemptions, "usado", "usados")} no caixa`,
          href: can("stores.view") ? PATHS.store(t.store.id, "desempenho") : undefined,
        }))}
      />
    </Card>
  );
}

export function TopCouponsCard({ items }: { items: DashboardOverview["topCoupons"] }) {
  return (
    <Card>
      <CardHeader
        title="Cupons mais pegos"
        description="Com o que ainda resta no estoque"
        icon={TicketPercent}
      />
      <BarList
        label="Cupons mais pegos"
        emptyText="Nenhum cupom pego no período."
        items={items.map((t) => ({
          key: t.coupon.id,
          label: t.coupon.title,
          value: t.claims,
          valueText: formatNumber(t.claims),
          sublabel: (
            <span className="flex flex-wrap items-center gap-2">
              <DemoMark show={t.isDemo} />
              {t.store.name} · {plural(t.redemptions, "usado", "usados")}
              {t.remaining === 0 ? (
                <StatusBadge tone="danger">Esgotado</StatusBadge>
              ) : (
                <StatusBadge tone={t.remaining <= 5 ? "warning" : "neutral"}>
                  {t.remaining === 1 ? "Resta 1" : `Restam ${formatNumber(t.remaining)}`}
                </StatusBadge>
              )}
            </span>
          ),
        }))}
      />
    </Card>
  );
}

export function SealsByChallengeCard({
  items,
  demo = false,
}: {
  items: DashboardOverview["sealsByChallenge"];
  /** Há dados fictícios somando. */
  demo?: boolean;
}) {
  return (
    <Card>
      <CardHeader
        title={
          <>
            Selos por desafio <DemoMark show={demo} hint={DEMO_MIXED_HINT} />
          </>
        }
        description="Selos dados no período"
        icon={Award}
      />
      <BarList
        label="Selos dados por desafio"
        emptyText="Nenhum selo dado no período."
        items={items.map((t) => ({
          key: t.challenge.id,
          label: t.challenge.title,
          value: t.count,
          valueText: formatNumber(t.count),
          sublabel: `Selo ${t.seal.name}`,
          leading: (
            <SealIcon
              icon={t.seal.icon}
              from={t.seal.gradientFrom}
              to={t.seal.gradientTo}
              size="sm"
            />
          ),
        }))}
      />
    </Card>
  );
}

import type { DashboardOverview } from "@arp/contracts";
import {
  Award,
  CalendarDays,
  HandCoins,
  Percent,
  Ticket,
  TicketCheck,
  TicketPercent,
  UserPlus,
  Users,
} from "lucide-react";
import { formatCents, formatDelta, formatNumber, formatPercent } from "@/shared/lib/format";
import { KpiCard } from "@/shared/ui";

/** Os 9 indicadores do período, em tons variados (como o copiloto). */
export function DashboardKpis({
  kpis,
  periodLabel,
}: {
  kpis: DashboardOverview["kpis"];
  periodLabel: string;
}) {
  const vs = `vs ${periodLabel} anteriores`;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          tone="dark"
          label="Visitantes cadastrados"
          icon={Users}
          value={formatNumber(kpis.visitorsTotal.value)}
          delta={formatDelta(kpis.visitorsTotal.value, kpis.visitorsTotal.previous)}
          deltaLabel="vs fim do período anterior"
        />
        <KpiCard
          label="Novos cadastros"
          icon={UserPlus}
          value={formatNumber(kpis.visitorsNew.value)}
          delta={formatDelta(kpis.visitorsNew.value, kpis.visitorsNew.previous)}
          deltaLabel={vs}
        />
        <KpiCard
          tone="green"
          label="Cupons pegos"
          icon={TicketPercent}
          value={formatNumber(kpis.couponsClaimed.value)}
          delta={formatDelta(kpis.couponsClaimed.value, kpis.couponsClaimed.previous)}
          deltaLabel={vs}
        />
        <KpiCard
          label="Cupons usados"
          icon={TicketCheck}
          value={formatNumber(kpis.couponsRedeemed.value)}
          delta={formatDelta(kpis.couponsRedeemed.value, kpis.couponsRedeemed.previous)}
          deltaLabel={vs}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        <KpiCard
          label="Taxa de uso"
          icon={Percent}
          value={formatPercent(kpis.redemptionRate.value)}
          delta={formatDelta(kpis.redemptionRate.value, kpis.redemptionRate.previous, "points")}
          deltaLabel={vs}
          hint="Usados ÷ pegos no período"
        />
        <KpiCard
          label="Economia gerada"
          icon={HandCoins}
          value={formatCents(kpis.savingsCents.value, { whole: true })}
          delta={formatDelta(kpis.savingsCents.value, kpis.savingsCents.previous)}
          deltaLabel={vs}
          hint="Estimada pelos cupons usados"
        />
        <KpiCard
          tone="dark"
          label="Selos dados"
          icon={Award}
          value={formatNumber(kpis.sealsAwarded.value)}
          delta={formatDelta(kpis.sealsAwarded.value, kpis.sealsAwarded.previous)}
          deltaLabel={vs}
        />
        <KpiCard
          label="Promoções ativas"
          icon={Ticket}
          value={formatNumber(kpis.activeCoupons.value)}
          delta={formatDelta(kpis.activeCoupons.value, kpis.activeCoupons.previous)}
          deltaLabel="vs fim do período anterior"
        />
        <KpiCard
          label="Próximos eventos"
          icon={CalendarDays}
          value={formatNumber(kpis.upcomingEvents.value)}
          hint="Publicados, a partir de hoje"
        />
      </div>
    </div>
  );
}

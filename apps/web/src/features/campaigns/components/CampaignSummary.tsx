import type { Campaign } from "@arp/contracts";
import { Award, Gift, Target, Users } from "lucide-react";
import { PATHS } from "@/shared/config/paths";
import { formatNumber, formatPercent, plural } from "@/shared/lib/format";
import { ButtonLink, Card, CardHeader, IconTile, KpiCard } from "@/shared/ui";
import { BarList } from "@/shared/ui/charts";
import { formatPeriod, periodProgress } from "../lib/period";
import { PeriodBar } from "./PeriodBar";

/** Resumo da campanha: desafios, participantes, selos dados e quem alcançou cada faixa. */
export function CampaignSummary({ campaign }: { campaign: Campaign }) {
  const progress = periodProgress(campaign.startsAt, campaign.endsAt);
  const tiers = [...campaign.tiers].sort((a, b) => a.threshold - b.threshold);
  const perParticipant =
    campaign.participantsCount > 0 ? campaign.sealsAwarded / campaign.participantsCount : 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label="Desafios"
          value={formatNumber(campaign.challengesCount)}
          icon={Target}
          hint={
            <ButtonLink
              to={PATHS.campaign(campaign.id, "desafios")}
              variant="ghost"
              size="sm"
              className="-ml-3"
            >
              Ver desafios
            </ButtonLink>
          }
        />
        <KpiCard
          label="Participantes"
          value={formatNumber(campaign.participantsCount)}
          icon={Users}
          tone="dark"
          hint="Visitantes com ao menos um selo"
        />
        <KpiCard
          label="Selos dados"
          value={formatNumber(campaign.sealsAwarded)}
          icon={Award}
          tone="green"
          hint={
            campaign.participantsCount > 0
              ? `${formatNumber(perParticipant, 1)} por participante`
              : "Nenhum ainda"
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Card>
          <CardHeader
            title="Quem alcançou cada faixa"
            description="Visitantes que juntaram selos suficientes para o benefício."
            icon={Gift}
          />
          <BarList
            label="Visitantes por faixa de benefício"
            emptyText="A campanha ainda não tem faixas de benefício."
            items={tiers.map((t) => ({
              key: t.id,
              label: `${t.threshold} selos · ${t.label}`,
              value: t.reachedCount,
              valueText: plural(t.reachedCount, "visitante", "visitantes"),
              sublabel:
                campaign.participantsCount > 0
                  ? `${formatPercent(t.reachedCount / campaign.participantsCount)} dos participantes`
                  : undefined,
              leading: <IconTile icon={t.icon} size="sm" />,
            }))}
          />
        </Card>
        <Card>
          <CardHeader
            title="Período"
            description={formatPeriod(campaign.startsAt, campaign.endsAt)}
          />
          <PeriodBar progress={progress} draft={campaign.status === "draft"} />
          <ButtonLink
            to={PATHS.earnedSeals({ campaignId: campaign.id })}
            variant="secondary"
            size="sm"
            icon={Award}
            className="mt-5"
          >
            Selos conquistados
          </ButtonLink>
        </Card>
      </div>
    </div>
  );
}

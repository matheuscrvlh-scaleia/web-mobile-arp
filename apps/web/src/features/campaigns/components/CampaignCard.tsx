import type { Campaign } from "@arp/contracts";
import { Award, CalendarDays, Target, Users } from "lucide-react";
import { Link } from "react-router";
import { useAuth } from "@/shared/auth";
import { PATHS } from "@/shared/config/paths";
import { cn } from "@/shared/lib/cn";
import { formatNumber } from "@/shared/lib/format";
import { iconFor } from "@/shared/lib/icons";
import { DemoMark, LifecycleBadge } from "@/shared/ui";
import {
  CAMPAIGN_LIFECYCLE_LABEL,
  campaignLifecycle,
  campaignLifecycleHint,
} from "../lib/lifecycle";
import { formatPeriod, periodProgress } from "../lib/period";
import { CampaignCardMenu } from "./CampaignActions";
import { PeriodBar } from "./PeriodBar";

/**
 * Cartão da campanha na lista: situação, período, números e faixas. O
 * cartão inteiro abre a campanha; o "⋯" (Duplicar, Arquivar, Excluir…)
 * fica por cima, no canto.
 */
export function CampaignCard({ campaign }: { campaign: Campaign }) {
  const { can } = useAuth();
  const live = campaign.status === "published" && campaign.phase === "live";
  const status = campaignLifecycle(campaign);
  const tiers = [...campaign.tiers].sort((a, b) => a.threshold - b.threshold);
  return (
    <div
      className={cn(
        "flutua relative flex h-full flex-col gap-4 rounded-[1.75rem] p-5",
        live ? "tom-escuro" : "vidro",
        campaign.status === "archived" && "opacity-70",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-lg font-semibold tracking-tight text-neutral-900">
            <Link
              to={PATHS.campaign(campaign.id)}
              className="truncate after:absolute after:inset-0 after:rounded-[1.75rem] hover:underline focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-neutral-900"
            >
              {campaign.name}
            </Link>
            <DemoMark show={campaign.isDemo} />
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-neutral-500">
            <CalendarDays className="size-3.5" aria-hidden />
            {formatPeriod(campaign.startsAt, campaign.endsAt)}
          </p>
        </div>
        {can("challenges.manage") && (
          <span className="relative z-10 -mt-1 -mr-1 shrink-0">
            <CampaignCardMenu campaign={campaign} />
          </span>
        )}
      </div>
      <LifecycleBadge
        status={status}
        label={CAMPAIGN_LIFECYCLE_LABEL[status]}
        hint={campaignLifecycleHint(campaign)}
      />
      {campaign.status === "published" && (
        <PeriodBar progress={periodProgress(campaign.startsAt, campaign.endsAt)} />
      )}
      <dl className="grid grid-cols-3 gap-2">
        <Stat icon={Target} label="desafios" value={campaign.challengesCount} />
        <Stat icon={Users} label="participantes" value={campaign.participantsCount} />
        <Stat icon={Award} label="selos dados" value={campaign.sealsAwarded} />
      </dl>
      {tiers.length > 0 && (
        <ul aria-label="Faixas de benefício" className="mt-auto flex flex-wrap gap-1.5">
          {tiers.map((t) => {
            const Icon = iconFor(t.icon);
            return (
              <li
                key={t.id}
                className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-neutral-900/[0.06] px-2.5 py-1 text-xs text-neutral-700"
              >
                <Icon className="size-3.5 shrink-0" aria-hidden />
                <b className="font-semibold tabular-nums">{t.threshold}</b>
                <span className="truncate">{t.label}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Award; label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-neutral-900/[0.04] px-3 py-2">
      <dt className="flex items-center gap-1 text-[11px] text-neutral-500">
        <Icon className="size-3" aria-hidden />
        {label}
      </dt>
      <dd className="text-lg font-semibold tabular-nums">{formatNumber(value)}</dd>
    </div>
  );
}

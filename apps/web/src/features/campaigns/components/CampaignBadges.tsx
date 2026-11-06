import type { Campaign } from "@arp/contracts";
import { LifecycleBadge } from "@/shared/ui";
import { CAMPAIGN_LIFECYCLE_LABEL, campaignLifecycle } from "../lib/lifecycle";

/**
 * Situação da campanha no ciclo de vida padrão: Rascunho, Agendada, No ar,
 * Encerrada ou Arquivada (publicada vira a fase em relação a agora).
 */
export function CampaignStatusBadge({
  campaign,
  hint,
}: {
  campaign: Pick<Campaign, "status" | "phase">;
  hint?: string;
}) {
  const status = campaignLifecycle(campaign);
  return <LifecycleBadge status={status} label={CAMPAIGN_LIFECYCLE_LABEL[status]} hint={hint} />;
}

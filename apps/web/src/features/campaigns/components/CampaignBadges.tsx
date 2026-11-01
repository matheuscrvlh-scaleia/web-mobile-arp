import type { Campaign, CampaignStatus } from "@arp/contracts";
import { Archive, PencilLine } from "lucide-react";
import { PhaseBadge, StatusBadge } from "@/shared/ui";

export const CAMPAIGN_STATUS_LABEL: Record<CampaignStatus, string> = {
  draft: "Rascunho",
  published: "Publicada",
  archived: "Arquivada",
};

/**
 * Situação da campanha. Publicada mostra a fase (em breve, no ar,
 * encerrada); rascunho e arquivada não aparecem no app, então a fase não
 * importa.
 */
export function CampaignStatusBadge({
  campaign,
}: {
  campaign: Pick<Campaign, "status" | "phase">;
}) {
  if (campaign.status === "draft")
    return (
      <StatusBadge tone="neutral" icon={PencilLine}>
        Rascunho (fora do app)
      </StatusBadge>
    );
  if (campaign.status === "archived")
    return (
      <StatusBadge tone="neutral" icon={Archive}>
        Arquivada
      </StatusBadge>
    );
  return <PhaseBadge phase={campaign.phase} />;
}

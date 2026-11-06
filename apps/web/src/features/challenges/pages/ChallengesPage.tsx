import { type Campaign, listChallengesQuerySchema } from "@arp/contracts";
import { Plus, Trophy } from "lucide-react";
import { Link } from "react-router";
import { CampaignStatusBadge, useCampaigns } from "@/features/campaigns";
import { PATHS } from "@/shared/config/paths";
import { useUrlState } from "@/shared/hooks";
import { formatDateShort } from "@/shared/lib/format";
import {
  ButtonLink,
  Can,
  Card,
  EmptyState,
  ErrorState,
  FilterBar,
  PageHeader,
  Select,
  SkeletonGrid,
} from "@/shared/ui";
import { ChallengeList } from "../components/ChallengeList";

/** Sem campanha na URL: a que está no ar, senão a próxima, senão a mais recente. */
function defaultCampaign(list: Campaign[]): Campaign | undefined {
  const published = list.filter((c) => c.status === "published");
  return (
    published.find((c) => c.phase === "live") ??
    published.find((c) => c.phase === "upcoming") ??
    [...list]
      .filter((c) => c.status !== "archived")
      .sort((a, b) => b.startsAt.localeCompare(a.startsAt))[0] ??
    list[0]
  );
}

/**
 * Atalho para os desafios de uma campanha (a casa deles é a aba Desafios da
 * campanha). A situação da campanha fica fora do select, para não cortar.
 */
export function ChallengesPage() {
  const [query, setQuery] = useUrlState(listChallengesQuerySchema);
  const campaigns = useCampaigns();
  const list = campaigns.data ?? [];
  const campaign =
    (query.campaignId && list.find((c) => c.id === query.campaignId)) || defaultCampaign(list);
  // Arquivadas só aparecem no select se já estiverem escolhidas.
  const options = list.filter((c) => c.status !== "archived" || c.id === campaign?.id);

  return (
    <>
      <PageHeader
        title="Desafios"
        description="O que o visitante faz para ganhar cada selo da campanha."
      />
      {campaigns.error ? (
        <Card>
          <ErrorState error={campaigns.error} onRetry={() => void campaigns.refetch()} />
        </Card>
      ) : !campaigns.data ? (
        <SkeletonGrid count={4} className="grid-cols-1" itemClassName="h-24" />
      ) : !campaign ? (
        <Card>
          <EmptyState
            icon={Trophy}
            title="Nenhuma campanha ainda"
            description="Os desafios ficam dentro de uma campanha. Crie a campanha primeiro."
            action={
              <Can permission="challenges.manage">
                <ButtonLink to={PATHS.campaignNew} icon={Plus}>
                  Nova campanha
                </ButtonLink>
              </Can>
            }
          />
        </Card>
      ) : (
        <>
          <FilterBar className="items-center">
            <Select
              aria-label="Campanha"
              value={campaign.id}
              onChange={(e) => setQuery({ campaignId: e.target.value })}
              className="w-full sm:w-96"
            >
              {options.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <CampaignStatusBadge campaign={campaign} />
            <span className="text-sm text-neutral-500">
              {formatDateShort(campaign.startsAt)} – {formatDateShort(campaign.endsAt)}
            </span>
            <Link
              to={PATHS.campaign(campaign.id, "desafios")}
              className="text-sm font-medium text-neutral-700 underline-offset-4 hover:underline"
            >
              Abrir campanha
            </Link>
          </FilterBar>
          <ChallengeList key={campaign.id} campaign={campaign} />
        </>
      )}
    </>
  );
}

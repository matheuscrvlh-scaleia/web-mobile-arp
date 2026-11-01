import { type Campaign, listChallengesQuerySchema } from "@arp/contracts";
import { Plus, Target, Trophy } from "lucide-react";
import { Link } from "react-router";
import { useCampaigns } from "@/features/campaigns";
import { PATHS } from "@/shared/config/paths";
import { useUrlState } from "@/shared/hooks";
import { formatDateShort, plural } from "@/shared/lib/format";
import {
  ButtonLink,
  Can,
  Card,
  EmptyState,
  ErrorState,
  FilterBar,
  PageHeader,
  PHASE_LABEL,
  PhaseBadge,
  Select,
  SkeletonGrid,
} from "@/shared/ui";
import { useChallenges } from "../api";
import { ChallengeListItem } from "../components/ChallengeListItem";

/** Sem campanha na URL: a que está no ar, senão a próxima, senão a mais recente. */
function defaultCampaign(list: Campaign[]): Campaign | undefined {
  const published = list.filter((c) => c.status === "published");
  return (
    published.find((c) => c.phase === "live") ??
    published.find((c) => c.phase === "upcoming") ??
    [...list].sort((a, b) => b.startsAt.localeCompare(a.startsAt))[0]
  );
}

function optionLabel(c: Campaign): string {
  if (c.status === "draft") return `${c.name} (rascunho)`;
  if (c.status === "archived") return `${c.name} (arquivada)`;
  return `${c.name} · ${PHASE_LABEL[c.phase].toLowerCase()}`;
}

export function ChallengesPage() {
  const [query, setQuery] = useUrlState(listChallengesQuerySchema);
  const campaigns = useCampaigns();
  const list = campaigns.data ?? [];
  const campaign =
    (query.campaignId && list.find((c) => c.id === query.campaignId)) || defaultCampaign(list);
  const challenges = useChallenges(campaign?.id, { enabled: Boolean(campaign) });
  const rows = [...(challenges.data ?? [])].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title),
  );

  return (
    <>
      <PageHeader
        title="Desafios"
        description="O que o visitante faz para ganhar cada selo da campanha."
        actions={
          campaign && (
            <Can permission="challenges.manage">
              <ButtonLink to={PATHS.challengeNew(campaign.id)} icon={Plus}>
                Novo desafio
              </ButtonLink>
            </Can>
          )
        }
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
              className="w-full sm:w-80"
            >
              {list.map((c) => (
                <option key={c.id} value={c.id}>
                  {optionLabel(c)}
                </option>
              ))}
            </Select>
            {campaign.status === "published" && <PhaseBadge phase={campaign.phase} />}
            <span className="text-sm text-neutral-500">
              {formatDateShort(campaign.startsAt)} – {formatDateShort(campaign.endsAt)}
            </span>
            <Link
              to={PATHS.campaign(campaign.id)}
              className="text-sm font-medium text-neutral-700 underline-offset-4 hover:underline"
            >
              Ver campanha
            </Link>
          </FilterBar>

          {challenges.error ? (
            <Card>
              <ErrorState error={challenges.error} onRetry={() => void challenges.refetch()} />
            </Card>
          ) : !challenges.data ? (
            <SkeletonGrid count={4} className="grid-cols-1" itemClassName="h-24" />
          ) : rows.length === 0 ? (
            <Card>
              <EmptyState
                icon={Target}
                title="Nenhum desafio nesta campanha"
                description="Comece por desafios fáceis de comprovar: tour, descarte, evento, estacionamento."
                action={
                  <Can permission="challenges.manage">
                    <ButtonLink to={PATHS.challengeNew(campaign.id)} icon={Plus}>
                      Novo desafio
                    </ButtonLink>
                  </Can>
                }
              />
            </Card>
          ) : (
            <>
              <p className="mb-3 text-sm text-neutral-500" aria-live="polite">
                {plural(rows.length, "desafio", "desafios")} · cada um dá um selo
              </p>
              <ul
                aria-label={`Desafios de ${campaign.name}`}
                aria-busy={challenges.isFetching || undefined}
                className="flex flex-col gap-3"
              >
                {rows.map((c) => (
                  <li key={c.id}>
                    <ChallengeListItem challenge={c} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </>
  );
}

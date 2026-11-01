import type { Campaign } from "@arp/contracts";
import { Plus, SearchX, Trophy } from "lucide-react";
import { PATHS } from "@/shared/config/paths";
import { useSearchParamOption } from "@/shared/hooks";
import {
  ButtonLink,
  Can,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  Segmented,
  SkeletonGrid,
  type TabItem,
} from "@/shared/ui";
import { useCampaigns } from "../api";
import { CampaignCard } from "../components/CampaignCard";

type Filter = "todas" | "no-ar" | "em-breve" | "encerradas" | "rascunhos";
const FILTERS: readonly Filter[] = ["todas", "no-ar", "em-breve", "encerradas", "rascunhos"];

const MATCH: Record<Filter, (c: Campaign) => boolean> = {
  todas: () => true,
  "no-ar": (c) => c.status === "published" && c.phase === "live",
  "em-breve": (c) => c.status === "published" && c.phase === "upcoming",
  encerradas: (c) => c.status === "archived" || (c.status === "published" && c.phase === "ended"),
  rascunhos: (c) => c.status === "draft",
};

/** No ar primeiro, depois as próximas, rascunhos e por fim as que já acabaram. */
function rank(c: Campaign): number {
  if (c.status === "published" && c.phase === "live") return 0;
  if (c.status === "published" && c.phase === "upcoming") return 1;
  if (c.status === "draft") return 2;
  return 3;
}

export function CampaignsPage() {
  const campaigns = useCampaigns();
  const [filter, setFilter] = useSearchParamOption("fase", FILTERS, "todas");
  const all = campaigns.data ?? [];
  const list = all
    .filter(MATCH[filter])
    .sort((a, b) => rank(a) - rank(b) || b.startsAt.localeCompare(a.startsAt));
  const options: TabItem<Filter>[] = [
    { value: "todas", label: "Todas", count: all.length },
    { value: "no-ar", label: "No ar", count: all.filter(MATCH["no-ar"]).length },
    { value: "em-breve", label: "Em breve", count: all.filter(MATCH["em-breve"]).length },
    { value: "encerradas", label: "Encerradas" },
    { value: "rascunhos", label: "Rascunhos" },
  ];

  return (
    <>
      <PageHeader
        title="Campanhas"
        description="Campanhas mensais de selos: período, publicação e faixas de benefício."
        actions={
          <Can permission="challenges.manage">
            <ButtonLink to={PATHS.campaignNew} icon={Plus}>
              Nova campanha
            </ButtonLink>
          </Can>
        }
      />
      <Segmented
        label="Filtrar campanhas"
        size="sm"
        options={options}
        value={filter}
        onChange={setFilter}
        className="mb-5"
      />
      {campaigns.error ? (
        <Card>
          <ErrorState error={campaigns.error} onRetry={() => void campaigns.refetch()} />
        </Card>
      ) : !campaigns.data ? (
        <SkeletonGrid count={3} className="md:grid-cols-2 xl:grid-cols-3" itemClassName="h-64" />
      ) : list.length === 0 ? (
        <Card>
          {all.length === 0 ? (
            <EmptyState
              icon={Trophy}
              title="Nenhuma campanha ainda"
              description="Crie a campanha do mês, depois os desafios e as faixas de benefício."
              action={
                <Can permission="challenges.manage">
                  <ButtonLink to={PATHS.campaignNew} icon={Plus}>
                    Nova campanha
                  </ButtonLink>
                </Can>
              }
            />
          ) : (
            <EmptyState
              icon={SearchX}
              title="Nenhuma campanha neste filtro"
              description="Escolha outro filtro acima."
            />
          )}
        </Card>
      ) : (
        <ul aria-label="Campanhas" className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((c) => (
            <li key={c.id}>
              <CampaignCard campaign={c} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

import type { Campaign } from "@arp/contracts";
import { Plus, SearchX, Trophy } from "lucide-react";
import { useState } from "react";
import { PATHS } from "@/shared/config/paths";
import { useSearchParamOption } from "@/shared/hooks";
import { normalize } from "@/shared/lib/text";
import {
  ButtonLink,
  Can,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  SearchInput,
  SkeletonGrid,
  StatusTabs,
  statusTabLabel,
  type TabItem,
} from "@/shared/ui";
import { useCampaigns } from "../api";
import { CampaignCard } from "../components/CampaignCard";

type Filter = "todas" | "no-ar" | "em-breve" | "rascunhos" | "encerradas" | "arquivadas";
const FILTERS: readonly Filter[] = [
  "todas",
  "no-ar",
  "em-breve",
  "rascunhos",
  "encerradas",
  "arquivadas",
];

// Arquivada sai das listas do dia a dia: só aparece na aba própria.
const MATCH: Record<Filter, (c: Campaign) => boolean> = {
  todas: (c) => c.status !== "archived",
  "no-ar": (c) => c.status === "published" && c.phase === "live",
  "em-breve": (c) => c.status === "published" && c.phase === "upcoming",
  rascunhos: (c) => c.status === "draft",
  encerradas: (c) => c.status === "published" && c.phase === "ended",
  arquivadas: (c) => c.status === "archived",
};

/** Ativas primeiro, depois as próximas, rascunhos e por fim as que já acabaram. */
function rank(c: Campaign): number {
  if (c.status === "published" && c.phase === "live") return 0;
  if (c.status === "published" && c.phase === "upcoming") return 1;
  if (c.status === "draft") return 2;
  return 3;
}

export function CampaignsPage() {
  const campaigns = useCampaigns();
  const [filter, setFilter] = useSearchParamOption("fase", FILTERS, "todas");
  const [search, setSearch] = useState("");
  const all = campaigns.data ?? [];
  const term = normalize(search.trim());
  const list = all
    .filter(MATCH[filter])
    .filter((c) => !term || normalize(c.name).includes(term))
    .sort((a, b) => rank(a) - rank(b) || b.startsAt.localeCompare(a.startsAt));
  const count = (f: Filter) => all.filter(MATCH[f]).length;
  const options: TabItem<Filter>[] = [
    { value: "todas", label: statusTabLabel("all", "a"), count: count("todas") },
    { value: "no-ar", label: statusTabLabel("active", "a"), count: count("no-ar") },
    { value: "em-breve", label: statusTabLabel("scheduled", "a"), count: count("em-breve") },
    { value: "rascunhos", label: statusTabLabel("draft", "a"), count: count("rascunhos") },
    { value: "encerradas", label: statusTabLabel("ended", "a"), count: count("encerradas") },
    { value: "arquivadas", label: statusTabLabel("archived", "a"), count: count("arquivadas") },
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
      <div className="flex flex-wrap items-start gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar campanha"
          label="Buscar campanha"
          className="mb-5 w-full sm:w-64"
        />
        <StatusTabs options={options} value={filter} onChange={setFilter} />
      </div>
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
              description={
                search ? "Confira o nome ou escolha outra situação." : "Escolha outro filtro acima."
              }
            />
          )}
        </Card>
      ) : (
        <ul
          data-guia="tabela"
          aria-label="Campanhas"
          className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
        >
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

import { type EarnedSeal, listEarnedSealsQuerySchema } from "@arp/contracts";
import { Award, FilterX, SearchX, UserRound, X } from "lucide-react";
import { useCallback } from "react";
import { Link } from "react-router";
import { useCampaigns } from "@/features/campaigns";
import { useChallenges } from "@/features/challenges";
import { useAuth } from "@/shared/auth";
import { PATHS } from "@/shared/config/paths";
import { useSearchText, useUrlState } from "@/shared/hooks";
import { formatDateTime, formatRelative } from "@/shared/lib/format";
import {
  Button,
  Card,
  type Column,
  EmptyState,
  ErrorState,
  FilterBar,
  Pagination,
  SearchInput,
  Select,
  Table,
} from "@/shared/ui";
import { useEarnedSeals } from "../api";
import { SealBadge } from "./SealBadge";

/** Quem ganhou qual selo, quando e em qual desafio (filtros na URL). */
export function EarnedSealsPanel() {
  const { can } = useAuth();
  const [query, setQuery] = useUrlState(listEarnedSealsQuerySchema);
  const commit = useCallback((q: string) => setQuery({ q }, { replace: true }), [setQuery]);
  const [search, setSearch] = useSearchText(query.q, commit);
  const earned = useEarnedSeals(query);
  const campaigns = useCampaigns();
  const challenges = useChallenges(query.campaignId, { enabled: Boolean(query.campaignId) });
  const filtered = Boolean(query.q || query.campaignId || query.challengeId || query.visitorId);
  const visitorName = query.visitorId
    ? earned.data?.data.find((e) => e.visitor.id === query.visitorId)?.visitor.name
    : undefined;

  const columns: Column<EarnedSeal>[] = [
    {
      key: "seal",
      header: "Selo",
      cell: (e) => (
        <span className="flex items-center gap-2.5">
          <SealBadge seal={e.seal} size={32} />
          <span className="font-medium text-neutral-900">{e.seal.name}</span>
        </span>
      ),
    },
    {
      key: "visitor",
      header: "Visitante",
      cell: (e) =>
        can("visitors.view") ? (
          <Link to={PATHS.visitor(e.visitor.id)} className="hover:underline">
            {e.visitor.name}
          </Link>
        ) : (
          e.visitor.name
        ),
    },
    {
      key: "challenge",
      header: "Desafio",
      cell: (e) => (
        <Link to={PATHS.challenge(e.challenge.id)} className="text-neutral-700 hover:underline">
          {e.challenge.title}
        </Link>
      ),
      className: "hidden md:table-cell",
    },
    {
      key: "campaign",
      header: "Campanha",
      cell: (e) => <span className="text-neutral-600">{e.campaign.name}</span>,
      className: "hidden lg:table-cell",
    },
    {
      key: "when",
      header: "Quando",
      numeric: true,
      cell: (e) => (
        <time dateTime={e.earnedAt} title={formatDateTime(e.earnedAt)} className="text-neutral-600">
          {formatRelative(e.earnedAt)}
        </time>
      ),
    },
  ];

  return (
    <>
      <FilterBar>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar visitante"
          label="Buscar visitante"
          className="w-full sm:w-64"
        />
        <Select
          aria-label="Campanha"
          placeholder="Todas as campanhas"
          value={query.campaignId ?? ""}
          onChange={(e) =>
            setQuery({ campaignId: e.target.value || undefined, challengeId: undefined })
          }
          className="w-full sm:w-56"
        >
          {(campaigns.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Desafio"
          placeholder={query.campaignId ? "Todos os desafios" : "Escolha a campanha"}
          disabled={!query.campaignId}
          value={query.challengeId ?? ""}
          onChange={(e) => setQuery({ challengeId: e.target.value || undefined })}
          className="w-full sm:w-56"
        >
          {(challenges.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </Select>
        {query.visitorId && (
          <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-neutral-900 pr-1 pl-3 text-sm text-white">
            <UserRound className="size-3.5" aria-hidden />
            {visitorName ?? "Um visitante"}
            <button
              type="button"
              onClick={() => setQuery({ visitorId: undefined })}
              aria-label="Tirar o filtro de visitante"
              className="grid size-7 cursor-pointer place-items-center rounded-full hover:bg-[rgb(255_255_255/0.15)]"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </span>
        )}
        {filtered && (
          <Button
            variant="ghost"
            size="sm"
            icon={FilterX}
            onClick={() => {
              setSearch("");
              setQuery({
                q: undefined,
                campaignId: undefined,
                challengeId: undefined,
                visitorId: undefined,
              });
            }}
          >
            Limpar filtros
          </Button>
        )}
      </FilterBar>
      <Card>
        {earned.error ? (
          <ErrorState error={earned.error} onRetry={() => void earned.refetch()} />
        ) : (
          <>
            <Table
              caption="Selos conquistados"
              columns={columns}
              rows={earned.data?.data}
              rowKey={(e) => e.id}
              loading={earned.isLoading}
              empty={
                filtered ? (
                  <EmptyState compact icon={SearchX} title="Nada com esses filtros" />
                ) : (
                  <EmptyState
                    compact
                    icon={Award}
                    title="Nenhum selo conquistado ainda"
                    description="Quando um visitante ler um QR Code de desafio, o selo aparece aqui."
                  />
                )
              }
            />
            {earned.data && (
              <Pagination meta={earned.data.meta} onPageChange={(page) => setQuery({ page })} />
            )}
          </>
        )}
      </Card>
    </>
  );
}

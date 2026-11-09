import { listVisitorsQuerySchema, type VisitorSummary, visitorStatusSchema } from "@arp/contracts";
import { Award, ChevronRight, FilterX, SearchX, UserRound } from "lucide-react";
import { useCallback } from "react";
import { PATHS } from "@/shared/config/paths";
import { useSearchText, useUrlState } from "@/shared/hooks";
import { formatDateTime, formatNumber, formatRelative } from "@/shared/lib/format";
import {
  Button,
  Card,
  type Column,
  DemoMark,
  EmptyState,
  ErrorState,
  FilterBar,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  Table,
} from "@/shared/ui";
import { useVisitors } from "../api";
import {
  OptInBadge,
  PROVIDER_LABEL,
  VisitorAvatar,
  VisitorStatusBadge,
} from "../components/VisitorBadges";

const STATUS_LABEL = { active: "Ativos", blocked: "Bloqueados" } as const;

const COLUMNS: Column<VisitorSummary>[] = [
  {
    key: "name",
    header: "Visitante",
    primary: true,
    cell: (v) => (
      <span className="flex items-center gap-3">
        <VisitorAvatar name={v.name} url={v.avatarUrl} muted={v.status === "blocked"} />
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 font-medium text-neutral-900">
            {v.name}
            <DemoMark show={v.isDemo} />
          </span>
          {/* Anonimizado: o e-mail é um marcador técnico, nunca vai para a tela. */}
          <span className="block text-xs font-normal break-all text-neutral-500">
            {v.anonymizedAt ? "Visitante anonimizado" : v.email}
          </span>
        </span>
      </span>
    ),
  },
  {
    key: "provider",
    header: "Entra com",
    cell: (v) => <span className="text-neutral-600">{PROVIDER_LABEL[v.authProvider]}</span>,
    className: "hidden xl:table-cell",
    hideOnMobile: true,
  },
  {
    key: "optIn",
    header: "Comunicação",
    cell: (v) => <OptInBadge optIn={v.marketingOptIn} />,
    className: "hidden md:table-cell",
  },
  {
    key: "seals",
    header: "Selos",
    numeric: true,
    cell: (v) => (
      <span className="inline-flex items-center gap-1">
        <Award className="size-3.5 text-neutral-400" aria-hidden />
        {formatNumber(v.sealsCount)}
      </span>
    ),
  },
  {
    key: "claims",
    header: "Cupons usados",
    numeric: true,
    cell: (v) => (
      <span>
        {formatNumber(v.redeemedClaimsCount)}
        {v.activeClaimsCount > 0 && (
          <span className="block text-xs text-neutral-500">
            +{formatNumber(v.activeClaimsCount)} aguardando
          </span>
        )}
      </span>
    ),
    className: "hidden lg:table-cell",
  },
  {
    key: "lastSeen",
    header: "Último acesso",
    cell: (v) =>
      v.lastSeenAt ? (
        <time
          dateTime={v.lastSeenAt}
          title={formatDateTime(v.lastSeenAt)}
          className="text-neutral-600"
        >
          {formatRelative(v.lastSeenAt)}
        </time>
      ) : (
        <span className="text-neutral-400">—</span>
      ),
    className: "hidden lg:table-cell",
  },
  {
    key: "status",
    header: "Situação",
    status: true,
    cell: (v) => <VisitorStatusBadge status={v.status} anonymized={Boolean(v.anonymizedAt)} />,
  },
  {
    key: "open",
    header: <span className="sr-only">Abrir</span>,
    numeric: true,
    hideOnMobile: true,
    // Só a seta: a linha inteira abre o visitante.
    cell: () => <ChevronRight className="inline size-4 text-neutral-400" aria-hidden />,
  },
];

export function VisitorsPage() {
  const [query, setQuery] = useUrlState(listVisitorsQuerySchema);
  const commit = useCallback((q: string) => setQuery({ q }, { replace: true }), [setQuery]);
  const [search, setSearch] = useSearchText(query.q, commit);
  const visitors = useVisitors(query);
  const filtered = Boolean(query.q || query.status || query.marketingOptIn);

  return (
    <>
      <PageHeader
        title="Usuários do app"
        description="Quem usa o app: selos, cupons, economia e preferências."
      />
      <FilterBar>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar por nome, e-mail ou celular"
          label="Buscar visitante"
          className="w-full sm:w-80"
        />
        <Select
          aria-label="Situação"
          placeholder="Ativos e bloqueados"
          value={query.status ?? ""}
          onChange={(e) => setQuery({ status: e.target.value })}
          className="w-full sm:w-48"
        >
          {visitorStatusSchema.options.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Comunicação"
          placeholder="Com e sem ofertas"
          value={query.marketingOptIn ?? ""}
          onChange={(e) => setQuery({ marketingOptIn: e.target.value })}
          className="w-full sm:w-52"
        >
          <option value="true">Aceitam ofertas</option>
          <option value="false">Não aceitam ofertas</option>
        </Select>
        {filtered && (
          <Button
            variant="ghost"
            size="sm"
            icon={FilterX}
            onClick={() => {
              setSearch("");
              setQuery({ q: undefined, status: undefined, marketingOptIn: undefined });
            }}
          >
            Limpar filtros
          </Button>
        )}
      </FilterBar>
      <Card>
        {visitors.error ? (
          <ErrorState error={visitors.error} onRetry={() => void visitors.refetch()} />
        ) : (
          <>
            <Table
              caption="Usuários do app"
              columns={COLUMNS}
              rows={visitors.data?.data}
              rowKey={(v) => v.id}
              rowHref={(v) => PATHS.visitor(v.id)}
              mobile="cards"
              loading={visitors.isLoading}
              empty={
                filtered ? (
                  <EmptyState
                    compact
                    icon={SearchX}
                    title="Ninguém com esses filtros"
                    description="Tente outro nome ou limpe os filtros."
                  />
                ) : (
                  <EmptyState
                    compact
                    icon={UserRound}
                    title="Nenhum visitante ainda"
                    description="As contas criadas no app aparecem aqui."
                  />
                )
              }
            />
            {visitors.data && (
              <Pagination meta={visitors.data.meta} onPageChange={(page) => setQuery({ page })} />
            )}
          </>
        )}
      </Card>
    </>
  );
}

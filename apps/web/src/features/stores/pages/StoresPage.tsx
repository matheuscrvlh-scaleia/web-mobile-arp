import { listStoresQuerySchema, type StoreSummary } from "@arp/contracts";
import { ChevronRight, LayoutGrid, List, Plus, SearchX, Store } from "lucide-react";
import { useCallback } from "react";
import { Link } from "react-router";
import { PATHS } from "@/shared/config/paths";
import { useSearchParamOption, useSearchText, useUrlState } from "@/shared/hooks";
import {
  ButtonLink,
  Can,
  Card,
  type Column,
  EmptyState,
  ErrorState,
  IconTile,
  PageHeader,
  Pagination,
  Segmented,
  SkeletonGrid,
  Table,
} from "@/shared/ui";
import { useStores } from "../api";
import { CouponsBadge, OpenNowBadge, StoreStatusBadge } from "../components/StoreBadges";
import { StoreCard } from "../components/StoreCard";
import { StoreFilters } from "../components/StoreFilters";

const VIEWS = ["cartoes", "tabela"] as const;

const COLUMNS: Column<StoreSummary>[] = [
  {
    key: "name",
    header: "Loja",
    cell: (s) => (
      <Link to={PATHS.store(s.id)} className="flex items-center gap-3 hover:underline">
        <IconTile icon={s.icon} color={s.brandColor} size="sm" />
        <span className="min-w-0">
          <span className="block font-medium text-neutral-900">{s.name}</span>
          <span className="block font-mono text-[11px] text-neutral-400">{s.slug}</span>
        </span>
      </Link>
    ),
  },
  { key: "category", header: "Categoria", cell: (s) => s.category.name },
  {
    key: "where",
    header: "Onde fica",
    cell: (s) => `${s.block.name} · ${s.floor.label}`,
    className: "hidden md:table-cell",
  },
  { key: "status", header: "Situação", cell: (s) => <StoreStatusBadge status={s.status} /> },
  {
    key: "now",
    header: "Agora",
    cell: (s) => (s.status === "active" ? <OpenNowBadge open={s.isOpenNow} /> : "—"),
    className: "hidden lg:table-cell",
  },
  {
    key: "coupons",
    header: "Cupons",
    cell: (s) => (s.activeCouponsCount > 0 ? <CouponsBadge count={s.activeCouponsCount} /> : "—"),
    className: "hidden lg:table-cell",
  },
  {
    key: "open",
    header: <span className="sr-only">Abrir</span>,
    numeric: true,
    cell: (s) => (
      <Link
        to={PATHS.store(s.id)}
        aria-label={`Abrir ${s.name}`}
        className="inline-grid size-8 place-items-center rounded-full text-neutral-400 hover:bg-neutral-900/[0.06] hover:text-neutral-900"
      >
        <ChevronRight className="size-4" aria-hidden />
      </Link>
    ),
  },
];

export function StoresPage() {
  const [query, setQuery] = useUrlState(listStoresQuerySchema);
  const [view, setView] = useSearchParamOption("visao", VIEWS, "cartoes");
  const commitSearch = useCallback((q: string) => setQuery({ q }, { replace: true }), [setQuery]);
  const [search, setSearch] = useSearchText(query.q, commitSearch);
  const stores = useStores({ ...query, pageSize: view === "cartoes" ? 24 : query.pageSize });
  const filtered = Boolean(
    query.q || query.kind || query.categoryId || query.floorId || query.blockId || query.status,
  );

  return (
    <>
      <PageHeader
        title="Lojas"
        description="O guia de lojas e alimentação do app: dados, horários, lugar no mapa e desempenho."
        actions={
          <>
            <Segmented
              label="Visualização"
              size="sm"
              value={view}
              onChange={setView}
              options={[
                { value: "cartoes", label: "Cartões", icon: LayoutGrid },
                { value: "tabela", label: "Tabela", icon: List },
              ]}
            />
            <Can permission="stores.manage">
              <ButtonLink to={PATHS.storeNew} icon={Plus}>
                Nova loja
              </ButtonLink>
            </Can>
          </>
        }
      />

      <StoreFilters
        search={search}
        onSearch={setSearch}
        filters={query}
        onChange={(p) => setQuery(p)}
      />

      {stores.error ? (
        <Card>
          <ErrorState error={stores.error} onRetry={() => void stores.refetch()} />
        </Card>
      ) : stores.data && stores.data.data.length === 0 ? (
        <Card>
          {filtered ? (
            <EmptyState
              icon={SearchX}
              title="Nenhuma loja com esses filtros"
              description="Tente outro nome ou limpe os filtros."
            />
          ) : (
            <EmptyState
              icon={Store}
              title="Nenhuma loja cadastrada"
              description="Cadastre a primeira loja para ela aparecer no guia do app."
              action={
                <Can permission="stores.manage">
                  <ButtonLink to={PATHS.storeNew} icon={Plus}>
                    Nova loja
                  </ButtonLink>
                </Can>
              }
            />
          )}
        </Card>
      ) : view === "cartoes" ? (
        stores.isLoading || !stores.data ? (
          <SkeletonGrid count={8} className="sm:grid-cols-2 xl:grid-cols-4" itemClassName="h-72" />
        ) : (
          <>
            <ul
              aria-label="Lojas"
              aria-busy={stores.isFetching || undefined}
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
            >
              {stores.data.data.map((s) => (
                <li key={s.id} className="flex">
                  <StoreCard store={s} />
                </li>
              ))}
            </ul>
            <Pagination meta={stores.data.meta} onPageChange={(page) => setQuery({ page })} />
          </>
        )
      ) : (
        <Card>
          <Table
            caption="Lojas"
            columns={COLUMNS}
            rows={stores.data?.data}
            rowKey={(s) => s.id}
            loading={stores.isLoading}
          />
          {stores.data && (
            <Pagination meta={stores.data.meta} onPageChange={(page) => setQuery({ page })} />
          )}
        </Card>
      )}
    </>
  );
}

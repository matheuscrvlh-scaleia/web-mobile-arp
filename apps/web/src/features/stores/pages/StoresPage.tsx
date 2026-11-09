import { listStoresQuerySchema, type StoreSort, type StoreSummary } from "@arp/contracts";
import {
  ExternalLink,
  FilterX,
  LayoutGrid,
  List,
  MapPin,
  Plus,
  Power,
  PowerOff,
  SearchX,
  Store,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { errorMessage } from "@/shared/api";
import { useAuth } from "@/shared/auth";
import { PATHS } from "@/shared/config/paths";
import { useIsMobile, useSearchParamOption, useUrlState } from "@/shared/hooks";
import { formatRelative } from "@/shared/lib/format";
import {
  ActionMenu,
  Button,
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
  Select,
  SkeletonGrid,
  Table,
  type TableSort,
  toast,
} from "@/shared/ui";
import { usePatchStore, useStores } from "../api";
import { confirmDeactivate } from "../components/confirm-deactivate";
import {
  CompletenessBadge,
  CouponsBadge,
  describeGaps,
  OpenNowBadge,
  StoreStatusBadge,
} from "../components/StoreBadges";
import { StoreBulkActions } from "../components/StoreBulkActions";
import { StoreCard } from "../components/StoreCard";
import { CLEAR_STORE_FILTERS, StoreFilters } from "../components/StoreFilters";

const VIEWS = ["cartoes", "tabela"] as const;
const PAGE_SIZES = [20, 50, 100] as const;

/** Coluna da tabela → ordenação da API. */
const SORT_OF: Record<string, StoreSort> = {
  name: "name",
  category: "category",
  where: "block",
  updated: "updated",
};

export function StoresPage() {
  const { can } = useAuth();
  const mobile = useIsMobile();
  const [query, setQuery] = useUrlState(listStoresQuerySchema);
  const [savedView, setView] = useSearchParamOption("visao", VIEWS, "cartoes");
  // No celular, sempre cartões (a tabela não cabe).
  const view = mobile ? "cartoes" : savedView;
  const commitSearch = useCallback((q: string) => setQuery({ q }, { replace: true }), [setQuery]);
  const stores = useStores({ ...query, pageSize: view === "cartoes" ? 24 : query.pageSize });
  const filtered = Boolean(
    query.q ||
      query.kind ||
      query.categoryId ||
      query.floorId ||
      query.blockId ||
      query.status ||
      query.missing,
  );
  const manage = can("stores.manage");
  const patch = usePatchStore();
  const navigate = useNavigate();
  const openStore = (id: string) => navigate(PATHS.store(id));
  const openMap = (floorId: string) => navigate(PATHS.map(floorId));

  // Marcadas para ação em lote (só as da página aberta).
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const rows = stores.data?.data;
  const selected = useMemo(() => (rows ?? []).filter((s) => checked.has(s.id)), [rows, checked]);
  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allChecked = Boolean(rows?.length) && selected.length === rows?.length;

  const setStatus = (s: StoreSummary, status: "active" | "inactive") =>
    patch.mutate(
      { id: s.id, body: { status } },
      {
        onSuccess: () =>
          toast.success(
            status === "active"
              ? `${s.name} reativada: volta a aparecer no app.`
              : `${s.name} desativada: saiu do app.`,
            {
              action: {
                label: "Desfazer",
                onClick: () =>
                  patch.mutate(
                    { id: s.id, body: { status: s.status } },
                    { onError: (e) => toast.error(errorMessage(e)) },
                  ),
              },
            },
          ),
        onError: (e) => toast.error(errorMessage(e)),
      },
    );

  const sort: TableSort = {
    key: Object.entries(SORT_OF).find(([, v]) => v === (query.sort ?? "name"))?.[0] ?? "name",
    direction: query.order ?? (query.sort === "updated" ? "desc" : "asc"),
  };

  const columns: Column<StoreSummary>[] = [
    ...(manage
      ? [
          {
            key: "check",
            header: (
              <input
                type="checkbox"
                aria-label="Marcar todas desta página"
                checked={allChecked}
                onChange={() =>
                  setChecked(allChecked ? new Set() : new Set((rows ?? []).map((s) => s.id)))
                }
                className="size-[1.125rem] cursor-pointer accent-neutral-900"
              />
            ),
            hideOnMobile: true,
            className: "w-10",
            cell: (s: StoreSummary) => (
              <input
                type="checkbox"
                aria-label={`Marcar ${s.name}`}
                checked={checked.has(s.id)}
                onChange={() => toggle(s.id)}
                className="size-[1.125rem] cursor-pointer accent-neutral-900"
              />
            ),
          },
        ]
      : []),
    {
      key: "name",
      header: "Loja",
      primary: true,
      sortable: true,
      cell: (s) => (
        <span className="flex items-center gap-3">
          <IconTile icon={s.icon} color={s.brandColor} size="sm" />
          <span className="min-w-0 font-medium text-neutral-900">{s.name}</span>
        </span>
      ),
    },
    { key: "category", header: "Categoria", sortable: true, cell: (s) => s.category.name },
    {
      key: "where",
      header: "Onde fica",
      sortable: true,
      cell: (s) => `${s.block.name} · ${s.floor.label}`,
      className: "hidden md:table-cell",
    },
    {
      key: "status",
      header: "Situação",
      status: true,
      cell: (s) =>
        s.status === "active" ? (
          <OpenNowBadge open={s.isOpenNow} hasHours={s.hasHours} />
        ) : (
          <StoreStatusBadge status={s.status} />
        ),
    },
    {
      key: "gaps",
      header: "Cadastro",
      mobileLabel: "Cadastro",
      cell: (s) =>
        s.missing.length === 0 ? (
          <span className="text-xs text-neutral-500">Completo</span>
        ) : (
          <span className="flex flex-col gap-0.5">
            <CompletenessBadge missing={s.missing} />
            <span className="text-[11px] text-neutral-500">Falta {describeGaps(s.missing)}</span>
          </span>
        ),
      className: "hidden lg:table-cell",
    },
    {
      key: "coupons",
      header: "Cupons",
      cell: (s) => (s.activeCouponsCount > 0 ? <CouponsBadge count={s.activeCouponsCount} /> : "—"),
      className: "hidden xl:table-cell",
    },
    {
      key: "updated",
      header: "Atualizada",
      sortable: true,
      cell: (s) => <span className="text-xs text-neutral-500">{formatRelative(s.updatedAt)}</span>,
      className: "hidden xl:table-cell",
    },
    {
      key: "actions",
      header: <span className="sr-only">Ações</span>,
      actions: true,
      numeric: true,
      cell: (s) => (
        <ActionMenu
          size="sm"
          ariaLabel={`Mais ações de ${s.name}`}
          items={[
            { label: "Abrir loja", icon: ExternalLink, onSelect: () => openStore(s.id) },
            can("map.view") && {
              label: "Ver no mapa",
              icon: MapPin,
              onSelect: () => openMap(s.floor.id),
            },
            manage &&
              (s.status === "active"
                ? {
                    label: "Desativar",
                    icon: PowerOff,
                    onSelect: () =>
                      void confirmDeactivate([s]).then((ok) => ok && setStatus(s, "inactive")),
                  }
                : { label: "Reativar", icon: Power, onSelect: () => setStatus(s, "active") }),
          ]}
        />
      ),
    },
  ];

  const clearFilters = () => {
    setQuery({ ...CLEAR_STORE_FILTERS, q: undefined });
  };

  return (
    <>
      <PageHeader
        title="Lojas"
        description="O guia de lojas e alimentação do app: dados, horários, lugar no mapa e desempenho."
        actions={
          <>
            {!mobile && (
              <Segmented
                label="Visualização"
                size="sm"
                value={savedView}
                onChange={(v) => {
                  setChecked(new Set());
                  setView(v);
                }}
                options={[
                  { value: "cartoes", label: "Cartões", icon: LayoutGrid },
                  { value: "tabela", label: "Tabela", icon: List },
                ]}
              />
            )}
            <Can permission="stores.manage">
              <ButtonLink to={PATHS.storeNew} icon={Plus}>
                Nova loja
              </ButtonLink>
            </Can>
          </>
        }
      />

      <StoreFilters
        q={query.q}
        onSearch={commitSearch}
        filters={query}
        onChange={(p) => {
          setChecked(new Set());
          setQuery(p);
        }}
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
              description="Tente outra busca ou veja todas as lojas."
              action={
                <Button variant="secondary" icon={FilterX} onClick={clearFilters}>
                  Limpar filtros
                </Button>
              }
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
              data-guia="tabela"
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
            columns={columns}
            rows={rows}
            rowKey={(s) => s.id}
            loading={stores.isLoading}
            rowHref={(s) => PATHS.store(s.id)}
            rowClassName={(s) => (s.status === "inactive" ? "opacity-70" : undefined)}
            mobile="cards"
            sort={sort}
            onSortChange={(next) => {
              setChecked(new Set());
              setQuery({ sort: SORT_OF[next.key] ?? "name", order: next.direction });
            }}
          />
          {stores.data && (
            <div className="flex flex-wrap items-end justify-between gap-3">
              <Pagination
                meta={stores.data.meta}
                onPageChange={(page) => {
                  setChecked(new Set());
                  setQuery({ page });
                }}
                className="flex-1"
              />
              <div className="flex items-center gap-2 pt-4 text-xs text-neutral-500">
                <span aria-hidden>Por página</span>
                <Select
                  aria-label="Lojas por página"
                  value={String(query.pageSize)}
                  onChange={(e) => {
                    setChecked(new Set());
                    setQuery({ pageSize: Number(e.target.value) });
                  }}
                  className="h-9 w-20"
                >
                  {PAGE_SIZES.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          )}
          {selected.length > 0 && (
            <StoreBulkActions selected={selected} onClear={() => setChecked(new Set())} />
          )}
        </Card>
      )}
    </>
  );
}

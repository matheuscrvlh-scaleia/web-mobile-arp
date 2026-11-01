import { type Coupon, listCouponsQuerySchema } from "@arp/contracts";
import { ChevronRight, LayoutGrid, List, Plus, SearchX, TicketPercent } from "lucide-react";
import { useCallback } from "react";
import { Link } from "react-router";
import { useAuth } from "@/shared/auth";
import { PATHS } from "@/shared/config/paths";
import { useSearchParamOption, useSearchText, useUrlState } from "@/shared/hooks";
import { cn } from "@/shared/lib/cn";
import { formatNumber } from "@/shared/lib/format";
import {
  ButtonLink,
  Can,
  Card,
  type Column,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  Segmented,
  SkeletonGrid,
  Table,
} from "@/shared/ui";
import { useCoupons } from "../api";
import { CouponStatusBadge } from "../components/CouponBadges";
import { CouponCard, couponCardData } from "../components/CouponCard";
import { CouponFilters } from "../components/CouponFilters";
import { CouponStatusActions } from "../components/CouponStatusActions";
import { couponPeriodShort } from "../lib/period";

const VIEWS = ["cartoes", "tabela"] as const;

const COLUMNS: Column<Coupon>[] = [
  {
    key: "title",
    header: "Promoção",
    cell: (c) => (
      <Link to={PATHS.coupon(c.id)} className="flex items-center gap-3 hover:underline">
        <span
          aria-hidden
          className={cn(
            `tom-app-${c.tone}`,
            "grid h-9 min-w-12 place-items-center rounded-xl px-2 text-xs font-extrabold tracking-tight",
          )}
        >
          {c.headline}
        </span>
        <span className="min-w-0">
          <span className="block max-w-72 truncate font-medium text-neutral-900">{c.title}</span>
          <span className="block text-xs text-neutral-500">{c.store.name}</span>
        </span>
      </Link>
    ),
  },
  { key: "status", header: "Situação", cell: (c) => <CouponStatusBadge status={c.status} /> },
  {
    key: "stock",
    header: "Restam",
    numeric: true,
    cell: (c) => (
      <span className={cn(c.stock.remaining <= 3 && c.stock.total > 0 && "text-red-700")}>
        {formatNumber(c.stock.remaining)}
        <span className="text-neutral-400"> de {formatNumber(c.stock.total)}</span>
      </span>
    ),
  },
  {
    key: "used",
    header: "Usados",
    numeric: true,
    cell: (c) => formatNumber(c.stock.redeemed),
    className: "hidden md:table-cell",
  },
  {
    key: "window",
    header: "Prazo p/ usar",
    numeric: true,
    cell: (c) => `${c.redeemWindowHours} h`,
    className: "hidden lg:table-cell",
  },
  {
    key: "period",
    header: "Período",
    cell: (c) => <span className="text-neutral-600">{couponPeriodShort(c)}</span>,
    className: "hidden lg:table-cell",
  },
  {
    key: "actions",
    header: <span className="sr-only">Ações</span>,
    numeric: true,
    cell: (c) => (
      <span className="flex items-center justify-end gap-1">
        <CouponStatusActions coupon={c} />
        <Link
          to={PATHS.coupon(c.id)}
          aria-label={`Abrir ${c.title}`}
          className="inline-grid size-8 place-items-center rounded-full text-neutral-400 hover:bg-neutral-900/[0.06] hover:text-neutral-900"
        >
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      </span>
    ),
  },
];

export function CouponsPage() {
  const { user } = useAuth();
  const merchant = Boolean(user?.store);
  const [query, setQuery] = useUrlState(listCouponsQuerySchema);
  const [view, setView] = useSearchParamOption("visao", VIEWS, "cartoes");
  const commitSearch = useCallback((q: string) => setQuery({ q }, { replace: true }), [setQuery]);
  const [search, setSearch] = useSearchText(query.q, commitSearch);
  const coupons = useCoupons({ ...query, pageSize: view === "cartoes" ? 24 : query.pageSize });
  const filtered = Boolean(query.q || query.storeId || query.status || query.kind);

  return (
    <>
      <PageHeader
        title="Promoções"
        description={
          merchant
            ? `Os cupons da ${user?.store?.name}: estoque, prazo para usar e situação.`
            : "Cupons das lojas no app: estoque, prazo para usar e situação."
        }
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
            <Can permission="coupons.manage">
              <ButtonLink to={PATHS.couponNew} icon={Plus}>
                Nova promoção
              </ButtonLink>
            </Can>
          </>
        }
      />

      <CouponFilters
        search={search}
        onSearch={setSearch}
        filters={query}
        onChange={(p) => setQuery(p)}
        merchant={merchant}
      />

      {coupons.error ? (
        <Card>
          <ErrorState error={coupons.error} onRetry={() => void coupons.refetch()} />
        </Card>
      ) : coupons.data && coupons.data.data.length === 0 ? (
        <Card>
          {filtered ? (
            <EmptyState
              icon={SearchX}
              title="Nenhuma promoção com esses filtros"
              description="Tente outro nome ou limpe os filtros."
            />
          ) : (
            <EmptyState
              icon={TicketPercent}
              title="Nenhuma promoção ainda"
              description="Crie a primeira: o visitante pega o cupom no app e mostra o código no caixa."
              action={
                <Can permission="coupons.manage">
                  <ButtonLink to={PATHS.couponNew} icon={Plus}>
                    Nova promoção
                  </ButtonLink>
                </Can>
              }
            />
          )}
        </Card>
      ) : view === "cartoes" ? (
        coupons.isLoading || !coupons.data ? (
          <SkeletonGrid count={6} className="sm:grid-cols-2 2xl:grid-cols-3" itemClassName="h-56" />
        ) : (
          <>
            <ul
              aria-label="Promoções"
              aria-busy={coupons.isFetching || undefined}
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3"
            >
              {coupons.data.data.map((c) => (
                <li key={c.id} className="flex">
                  <CouponTile coupon={c} />
                </li>
              ))}
            </ul>
            <Pagination meta={coupons.data.meta} onPageChange={(page) => setQuery({ page })} />
          </>
        )
      ) : (
        <Card>
          <Table
            caption="Promoções"
            columns={COLUMNS}
            rows={coupons.data?.data}
            rowKey={(c) => c.id}
            loading={coupons.isLoading}
          />
          {coupons.data && (
            <Pagination meta={coupons.data.meta} onPageChange={(page) => setQuery({ page })} />
          )}
        </Card>
      )}
    </>
  );
}

/** Cartão da lista: o cupom como no app + situação, período e ações rápidas. */
function CouponTile({ coupon }: { coupon: Coupon }) {
  const inactive = coupon.status !== "active";
  return (
    <article className="vidro flex w-full flex-col gap-2 rounded-[2rem] p-2">
      <Link
        to={PATHS.coupon(coupon.id)}
        className={cn("flutua block rounded-[1.75rem]", inactive && "opacity-75")}
      >
        <CouponCard data={couponCardData(coupon)} />
      </Link>
      <div className="flex flex-wrap items-center gap-2 px-2 pb-1">
        <CouponStatusBadge status={coupon.status} />
        <span className="text-xs text-neutral-500">{couponPeriodShort(coupon)}</span>
        <span className="ml-auto flex flex-wrap gap-1">
          <CouponStatusActions coupon={coupon} />
        </span>
      </div>
    </article>
  );
}

import { type Coupon, type CouponSort, listCouponsQuerySchema } from "@arp/contracts";
import { CircleCheck, LayoutGrid, List, Plus, SearchX, TicketPercent } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router";
import { useAuth } from "@/shared/auth";
import { PATHS } from "@/shared/config/paths";
import { useSearchParamOption, useSearchText, useUrlState } from "@/shared/hooks";
import { cn } from "@/shared/lib/cn";
import { formatDateShort, formatNumber } from "@/shared/lib/format";
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
  type TableSort,
} from "@/shared/ui";
import { useCoupons } from "../api";
import { CouponRowActions } from "../components/CouponActions";
import { CouponReviewBadge, CouponStatusBadge } from "../components/CouponBadges";
import { CouponBulkBar } from "../components/CouponBulkBar";
import { CouponCard, couponCardData } from "../components/CouponCard";
import { CouponFilters } from "../components/CouponFilters";
import { CouponReviewButtons } from "../components/CouponReviewActions";
import { deadlineShort } from "../lib/deadline";
import { couponPeriodShort } from "../lib/period";

const VIEWS = ["cartoes", "tabela"] as const;
type View = (typeof VIEWS)[number];

// A última visualização escolhida vale para a próxima vez (sem ?visao na URL).
const VIEW_KEY = "promocoes.visao";
function savedView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === "tabela" ? "tabela" : "cartoes";
  } catch {
    return "cartoes";
  }
}

/** Coluna da tabela → ordem da API (a primeira direção é a do primeiro clique). */
const SORT_BY_COLUMN: Record<string, { asc: CouponSort; desc: CouponSort }> = {
  title: { asc: "title", desc: "-title" },
  stock: { asc: "remaining", desc: "-remaining" },
  used: { asc: "used", desc: "-used" },
  period: { asc: "starts", desc: "-starts" },
  created: { asc: "created", desc: "-created" },
};

function tableSort(sort: CouponSort | undefined): TableSort {
  const value = sort ?? "-created";
  for (const [key, s] of Object.entries(SORT_BY_COLUMN)) {
    if (s.asc === value) return { key, direction: "asc" };
    if (s.desc === value) return { key, direction: "desc" };
  }
  return { key: "", direction: "desc" };
}

export function CouponsPage() {
  const { user, can } = useAuth();
  const merchant = Boolean(user?.store);
  const [query, setQuery] = useUrlState(listCouponsQuerySchema);
  const [initialView] = useState(savedView);
  const [chosenView, setViewParam] = useSearchParamOption("visao", VIEWS, initialView);
  const setView = (v: View) => {
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      // sem armazenamento: só não lembra
    }
    setViewParam(v);
  };
  // "Aprovar cupons" no menu = esta lista com ?review=pending (GER-10): fila enxuta,
  // sempre em cartões, com Aprovar/Recusar grandes.
  const reviewing = query.review === "pending";
  const view = reviewing ? "cartoes" : chosenView;
  const commitSearch = useCallback((q: string) => setQuery({ q }, { replace: true }), [setQuery]);
  const [search, setSearch] = useSearchText(query.q, commitSearch);
  const coupons = useCoupons({ ...query, pageSize: view === "cartoes" ? 24 : query.pageSize });
  const filtered = Boolean(
    query.q || query.storeId || query.lifecycle || query.kind || query.review,
  );
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const rows = coupons.data?.data;
  // A seleção vale só para o que está na tela (troca de página/filtro limpa o resto).
  const selectedRows = useMemo(
    () => (rows ?? []).filter((c) => selected.has(c.id)),
    [rows, selected],
  );
  const canManage = can("coupons.manage");
  const waiting = coupons.data?.meta.total ?? 0;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allSelected = Boolean(rows?.length) && selectedRows.length === rows?.length;

  // biome-ignore lint/correctness/useExhaustiveDependencies: toggle só usa setSelected
  const columns = useMemo<Column<Coupon>[]>(
    () => [
      ...(canManage
        ? [
            {
              key: "select",
              header: (
                <input
                  type="checkbox"
                  aria-label="Selecionar todas desta página"
                  checked={allSelected}
                  onChange={() =>
                    setSelected(allSelected ? new Set() : new Set((rows ?? []).map((c) => c.id)))
                  }
                  className="size-[1.125rem] cursor-pointer accent-neutral-900"
                />
              ),
              cell: (c: Coupon) => (
                <input
                  type="checkbox"
                  aria-label={`Selecionar ${c.title}`}
                  checked={selected.has(c.id)}
                  onChange={() => toggle(c.id)}
                  className="size-[1.125rem] cursor-pointer accent-neutral-900"
                />
              ),
              hideOnMobile: true,
              className: "w-8",
            },
          ]
        : []),
      {
        key: "title",
        header: "Promoção",
        primary: true,
        sortable: true,
        cell: (c) => (
          <span className="flex items-center gap-3">
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
              <span className="block max-w-72 truncate font-medium text-neutral-900">
                {c.title}
              </span>
              <span className="block text-xs text-neutral-500">{c.store.name}</span>
            </span>
          </span>
        ),
      },
      {
        key: "status",
        header: "Situação",
        status: true,
        cell: (c) => (
          <span className="inline-flex flex-col items-start gap-1.5">
            <span className="inline-flex flex-wrap gap-1">
              <CouponStatusBadge coupon={c} />
              <CouponReviewBadge review={c.review} />
            </span>
            {c.review === "pending" && (
              <span>
                <CouponReviewButtons coupon={c} />
              </span>
            )}
          </span>
        ),
      },
      {
        key: "stock",
        header: "Restam",
        numeric: true,
        sortable: true,
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
        sortable: true,
        cell: (c) => formatNumber(c.stock.redeemed),
      },
      {
        key: "window",
        header: "Prazo p/ usar",
        numeric: true,
        cell: (c) => deadlineShort(c),
        className: "hidden lg:table-cell",
      },
      {
        key: "period",
        header: "Período",
        sortable: true,
        cell: (c) => <span className="text-neutral-600">{couponPeriodShort(c)}</span>,
        className: "hidden xl:table-cell",
      },
      {
        key: "created",
        header: "Criada",
        sortable: true,
        cell: (c) => <span className="text-neutral-600">{formatDateShort(c.createdAt)}</span>,
        className: "hidden 2xl:table-cell",
        hideOnMobile: true,
      },
      {
        key: "actions",
        header: <span className="sr-only">Ações</span>,
        numeric: true,
        actions: true,
        cell: (c) => <CouponRowActions coupon={c} />,
      },
    ],
    [canManage, allSelected, rows, selected],
  );

  return (
    <>
      <PageHeader
        title={reviewing ? "Aprovar cupons" : "Promoções"}
        description={
          reviewing
            ? waiting > 0
              ? `${formatNumber(waiting)} ${waiting === 1 ? "cupom esperando" : "cupons esperando"} a ARP conferir. Aprovado, vai ao app quando estiver publicado; recusado, o lojista vê o motivo.`
              : "Cupons criados ou alterados por lojistas esperando a ARP conferir."
            : merchant
              ? `Os cupons da ${user?.store?.name}: estoque, prazo para usar e situação.`
              : "Cupons das lojas no app: estoque, prazo para usar e situação."
        }
        actions={
          reviewing ? null : (
            <>
              <Segmented
                label="Visualização"
                size="sm"
                value={view}
                onChange={(v) => {
                  setSelected(new Set());
                  setView(v);
                }}
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
          )
        }
      />

      <CouponFilters
        search={search}
        onSearch={setSearch}
        filters={query}
        onChange={(p) => {
          setSelected(new Set());
          setQuery(p);
        }}
        merchant={merchant}
        reviewing={reviewing}
      />

      {coupons.error ? (
        <Card>
          <ErrorState error={coupons.error} onRetry={() => void coupons.refetch()} />
        </Card>
      ) : coupons.data && coupons.data.data.length === 0 ? (
        <Card>
          {reviewing && !query.q && !query.storeId ? (
            <EmptyState
              icon={CircleCheck}
              title="Nenhum cupom esperando ✓"
              description="Quando um lojista criar ou alterar um cupom, ele aparece aqui para aprovar."
            />
          ) : filtered ? (
            <EmptyState
              icon={SearchX}
              title={
                query.lifecycle === "archived"
                  ? "Nenhuma promoção arquivada"
                  : "Nenhuma promoção com esses filtros"
              }
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
              data-guia="tabela"
              aria-label="Promoções"
              aria-busy={coupons.isFetching || undefined}
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3"
            >
              {coupons.data.data.map((c) => (
                <li key={c.id} className="flex min-w-0">
                  <CouponTile coupon={c} reviewing={reviewing} />
                </li>
              ))}
            </ul>
            <Pagination meta={coupons.data.meta} onPageChange={(page) => setQuery({ page })} />
          </>
        )
      ) : (
        <Card>
          {selectedRows.length > 0 && (
            <CouponBulkBar coupons={selectedRows} onDone={() => setSelected(new Set())} />
          )}
          <Table
            caption="Promoções"
            columns={columns}
            rows={rows}
            rowKey={(c) => c.id}
            rowHref={(c) => PATHS.coupon(c.id)}
            rowLabel={(c) => `Abrir ${c.title}`}
            loading={coupons.isLoading}
            mobile="cards"
            sort={tableSort(query.sort)}
            onSortChange={(s) => {
              const next = SORT_BY_COLUMN[s.key]?.[s.direction];
              setQuery({ sort: next === "-created" ? undefined : next });
            }}
          />
          {coupons.data && (
            <Pagination
              meta={coupons.data.meta}
              onPageChange={(page) => {
                setSelected(new Set());
                setQuery({ page });
              }}
            />
          )}
        </Card>
      )}
    </>
  );
}

/** Cartão da lista: o cupom como no app + situação, período e o "⋯". */
function CouponTile({ coupon, reviewing }: { coupon: Coupon; reviewing: boolean }) {
  const inactive = coupon.lifecycle !== "active" && coupon.lifecycle !== "scheduled";
  return (
    <article className="vidro flex w-full min-w-0 flex-col gap-2 rounded-[2rem] p-2">
      <Link
        to={PATHS.coupon(coupon.id)}
        // Inativa fica apagada; no escuro a opacidade deixa o texto cinza: lá o selo basta.
        className={cn("flutua block rounded-[1.75rem]", inactive && "opacity-75 dark:opacity-100")}
      >
        <CouponCard data={couponCardData(coupon)} />
      </Link>
      <div className="flex flex-wrap items-center gap-2 px-2 pb-1">
        {/* Na fila de aprovação só importa "Aguardando ARP" (não "Rascunho" junto). */}
        {!reviewing && <CouponStatusBadge coupon={coupon} />}
        <CouponReviewBadge review={coupon.review} />
        <span className="text-xs text-neutral-500">{couponPeriodShort(coupon)}</span>
        <span className="ml-auto inline-flex items-center gap-2">
          {coupon.review === "pending" && !reviewing && <CouponReviewButtons coupon={coupon} />}
          <CouponRowActions coupon={coupon} />
        </span>
      </div>
      {reviewing && coupon.review === "pending" && (
        <CouponReviewButtons
          coupon={coupon}
          size="lg"
          className="grid grid-cols-2 px-1 pb-1 [&>button]:w-full"
        />
      )}
    </article>
  );
}

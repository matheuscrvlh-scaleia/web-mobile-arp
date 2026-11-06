import { type CouponClaim, claimStatusSchema, listClaimsQuerySchema } from "@arp/contracts";
import { ClipboardCheck, Download, FilterX, SearchX, UserRound, Wallet, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { type CsvColumn, downloadCsv, PeriodFilter, useCoupons } from "@/features/coupons";
import { storeComboboxOptions, useStoreOptions } from "@/features/stores";
import { useAuth } from "@/shared/auth";
import { PATHS } from "@/shared/config/paths";
import { useDebouncedValue, useSearchText, useUrlState } from "@/shared/hooks";
import { todayIso } from "@/shared/lib/dates";
import { formatDateTime, formatNumber } from "@/shared/lib/format";
import {
  Button,
  ButtonLink,
  Can,
  Card,
  Combobox,
  EmptyState,
  ErrorState,
  FilterBar,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  toast,
} from "@/shared/ui";
import { CLAIMS_EXPORT_MAX, fetchAllClaims, useClaims } from "../api";
import { CLAIM_STATUS } from "../components/ClaimStatusBadge";
import { ClaimsTable, type HideableColumn } from "../components/ClaimsTable";

const HIDE_STORE: HideableColumn[] = ["store"];
const HIDE_NONE: HideableColumn[] = [];

const CSV_COLUMNS: CsvColumn<CouponClaim>[] = [
  { header: "Código", value: (c) => c.code },
  { header: "Situação", value: (c) => CLAIM_STATUS[c.status].label },
  { header: "Promoção", value: (c) => c.coupon.title },
  { header: "Destaque", value: (c) => c.coupon.headline },
  { header: "Loja", value: (c) => c.store.name },
  { header: "Visitante", value: (c) => c.visitor.name },
  { header: "Pegou em", value: (c) => formatDateTime(c.claimedAt) },
  { header: "Prazo", value: (c) => formatDateTime(c.expiresAt) },
  { header: "Usado em", value: (c) => (c.redeemedAt ? formatDateTime(c.redeemedAt) : "") },
  { header: "Validado por", value: (c) => c.redeemedBy?.name ?? "" },
];

export function ClaimsPage() {
  const { user } = useAuth();
  const merchant = Boolean(user?.store);
  const [query, setQuery] = useUrlState(listClaimsQuerySchema);
  const commit = useCallback((q: string) => setQuery({ q }, { replace: true }), [setQuery]);
  const [search, setSearch] = useSearchText(query.q, commit);
  const claims = useClaims(query);
  const stores = useStoreOptions({ enabled: !merchant });
  const storeOptions = useMemo(() => storeComboboxOptions(stores.data ?? []), [stores.data]);
  // Promoção com busca no servidor (as da loja escolhida; o lojista só vê as dele).
  const [couponTerm, setCouponTerm] = useState("");
  const couponQ = useDebouncedValue(couponTerm, 300);
  const coupons = useCoupons({
    storeId: query.storeId,
    q: couponQ || undefined,
    pageSize: 30,
    page: 1,
  });
  const couponOptions = useMemo(
    () =>
      (coupons.data?.data ?? []).map((c) => ({
        value: c.id,
        label: c.title,
        description: merchant || query.storeId ? c.headline : c.store.name,
      })),
    [coupons.data, merchant, query.storeId],
  );
  const [exporting, setExporting] = useState(false);
  const filtered = Boolean(
    query.q ||
      query.couponId ||
      query.storeId ||
      query.status ||
      query.visitorId ||
      query.from ||
      query.to,
  );
  // O nome do visitante filtrado vem das próprias linhas (todas são dele).
  const visitorName = query.visitorId
    ? claims.data?.data.find((c) => c.visitor.id === query.visitorId)?.visitor.name
    : undefined;
  const couponName = query.couponId
    ? claims.data?.data.find((c) => c.coupon.id === query.couponId)?.coupon.title
    : undefined;

  const exportCsv = async () => {
    setExporting(true);
    try {
      const { rows, truncated } = await fetchAllClaims(query);
      if (rows.length === 0) {
        toast.info("Nada para exportar com esses filtros.");
        return;
      }
      downloadCsv(`cupons-pegos-${todayIso()}.csv`, rows, CSV_COLUMNS);
      toast.success(
        truncated
          ? `Exportados os ${formatNumber(CLAIMS_EXPORT_MAX)} mais recentes. Filtre por período para pegar o resto.`
          : `${formatNumber(rows.length)} cupons pegos exportados.`,
      );
    } catch (e) {
      toast.fromError(e);
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Cupons pegos"
        description={
          merchant
            ? `Quem pegou cupom da ${user?.store?.name}, quando e se já usou.`
            : "Quem pegou cada cupom, quando e se já usou no caixa."
        }
        actions={
          <>
            <Button
              variant="secondary"
              icon={Download}
              loading={exporting}
              onClick={() => void exportCsv()}
            >
              Exportar CSV
            </Button>
            <Can permission="coupons.redeem">
              <ButtonLink to={PATHS.redeem} icon={ClipboardCheck}>
                Validar cupom
              </ButtonLink>
            </Can>
          </>
        }
      />
      <FilterBar>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar código ou visitante"
          label="Buscar cupom pego"
          className="w-full sm:w-72"
        />
        {!merchant && (
          <Combobox
            aria-label="Loja"
            placeholder="Todas as lojas"
            emptyText="Nenhuma loja com esse nome"
            options={storeOptions}
            loading={stores.isLoading}
            value={query.storeId ?? null}
            onChange={(v) => setQuery({ storeId: v ?? undefined, couponId: undefined })}
            className="w-full sm:w-56"
          />
        )}
        <Combobox
          aria-label="Promoção"
          placeholder="Todas as promoções"
          emptyText="Nenhuma promoção com esse nome"
          options={couponOptions}
          loading={coupons.isFetching}
          onSearch={setCouponTerm}
          selectedLabel={couponName}
          value={query.couponId ?? null}
          onChange={(v) => setQuery({ couponId: v ?? undefined })}
          className="w-full sm:w-64"
        />
        <Select
          aria-label="Situação"
          placeholder="Todas as situações"
          value={query.status ?? ""}
          onChange={(e) => setQuery({ status: e.target.value })}
          className="w-full sm:w-44"
        >
          {claimStatusSchema.options.map((s) => (
            <option key={s} value={s}>
              {CLAIM_STATUS[s].label}
            </option>
          ))}
        </Select>
        <PeriodFilter
          allowAll
          value={{ from: query.from, to: query.to }}
          onChange={(p) => setQuery({ from: p.from, to: p.to })}
        />
        {query.visitorId && (
          <span className="inline-flex h-10 items-center gap-2 rounded-full border border-neutral-200 bg-white pr-1 pl-3 text-sm text-neutral-800">
            <UserRound className="size-4 text-neutral-500" aria-hidden />
            {visitorName ?? "Um visitante"}
            <button
              type="button"
              onClick={() => setQuery({ visitorId: undefined })}
              aria-label="Tirar o filtro de visitante"
              className="grid size-8 cursor-pointer place-items-center rounded-full text-neutral-500 hover:bg-neutral-900/[0.06] hover:text-neutral-900"
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
                couponId: undefined,
                storeId: undefined,
                status: undefined,
                visitorId: undefined,
                from: undefined,
                to: undefined,
              });
            }}
          >
            Limpar filtros
          </Button>
        )}
      </FilterBar>
      <Card>
        {claims.error ? (
          <ErrorState error={claims.error} onRetry={() => void claims.refetch()} />
        ) : (
          <>
            <ClaimsTable
              caption="Cupons pegos"
              rows={claims.data?.data}
              loading={claims.isLoading}
              hide={merchant ? HIDE_STORE : HIDE_NONE}
              empty={
                filtered ? (
                  <EmptyState compact icon={SearchX} title="Nenhum cupom com esses filtros" />
                ) : (
                  <EmptyState
                    compact
                    icon={Wallet}
                    title="Ninguém pegou cupom ainda"
                    description="Quando um visitante pegar um cupom no app, ele aparece aqui."
                  />
                )
              }
            />
            {claims.data && (
              <Pagination meta={claims.data.meta} onPageChange={(page) => setQuery({ page })} />
            )}
          </>
        )}
      </Card>
    </>
  );
}

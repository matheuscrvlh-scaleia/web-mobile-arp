import { claimStatusSchema, listClaimsQuerySchema } from "@arp/contracts";
import { ClipboardCheck, FilterX, SearchX, UserRound, Wallet, X } from "lucide-react";
import { useCallback } from "react";
import { useCoupons } from "@/features/coupons";
import { useStoreOptions } from "@/features/stores";
import { useAuth } from "@/shared/auth";
import { PATHS } from "@/shared/config/paths";
import { useSearchText, useUrlState } from "@/shared/hooks";
import {
  Button,
  ButtonLink,
  Can,
  Card,
  EmptyState,
  ErrorState,
  FilterBar,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
} from "@/shared/ui";
import { useClaims } from "../api";
import { CLAIM_STATUS } from "../components/ClaimStatusBadge";
import { ClaimsTable, type HideableColumn } from "../components/ClaimsTable";

const HIDE_STORE: HideableColumn[] = ["store"];
const HIDE_NONE: HideableColumn[] = [];

export function ClaimsPage() {
  const { user } = useAuth();
  const merchant = Boolean(user?.store);
  const [query, setQuery] = useUrlState(listClaimsQuerySchema);
  const commit = useCallback((q: string) => setQuery({ q }, { replace: true }), [setQuery]);
  const [search, setSearch] = useSearchText(query.q, commit);
  const claims = useClaims(query);
  const stores = useStoreOptions({ enabled: !merchant });
  // Promoções para o filtro (as da loja escolhida; o lojista só vê as dele).
  const coupons = useCoupons({ storeId: query.storeId, pageSize: 100, page: 1 });
  const filtered = Boolean(
    query.q || query.couponId || query.storeId || query.status || query.visitorId,
  );
  // O nome do visitante filtrado vem das próprias linhas (todas são dele).
  const visitorName = query.visitorId
    ? claims.data?.data.find((c) => c.visitor.id === query.visitorId)?.visitor.name
    : undefined;

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
          <Can permission="coupons.redeem">
            <ButtonLink to={PATHS.redeem} icon={ClipboardCheck}>
              Validar cupom
            </ButtonLink>
          </Can>
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
          <Select
            aria-label="Loja"
            placeholder="Todas as lojas"
            value={query.storeId ?? ""}
            onChange={(e) => setQuery({ storeId: e.target.value, couponId: undefined })}
            className="w-full sm:w-52"
          >
            {(stores.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        )}
        <Select
          aria-label="Promoção"
          placeholder="Todas as promoções"
          value={query.couponId ?? ""}
          onChange={(e) => setQuery({ couponId: e.target.value })}
          className="w-full sm:w-64"
        >
          {(coupons.data?.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
              {merchant || query.storeId ? "" : ` · ${c.store.name}`}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Situação"
          placeholder="Todas as situações"
          value={query.status ?? ""}
          onChange={(e) => setQuery({ status: e.target.value })}
          className="w-full sm:w-48"
        >
          {claimStatusSchema.options.map((s) => (
            <option key={s} value={s}>
              {CLAIM_STATUS[s].label}
            </option>
          ))}
        </Select>
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

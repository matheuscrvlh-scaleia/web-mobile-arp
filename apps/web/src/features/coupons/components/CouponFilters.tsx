import {
  COUPON_REVIEW_LABEL,
  type CouponSort,
  couponReviewSchema,
  type ListCouponsQuery,
  STORE_KIND_LABEL,
  type StoreKind,
  storeKindSchema,
} from "@arp/contracts";
import { FilterX } from "lucide-react";
import { useMemo } from "react";
import { storeComboboxOptions, useStoreOptions } from "@/features/stores";
import { Button, Combobox, FilterBar, SearchInput, Segmented, Select } from "@/shared/ui";
import { COUPON_LIFECYCLE, LIFECYCLE_ORDER } from "./CouponBadges";

type Filters = Pick<ListCouponsQuery, "storeId" | "lifecycle" | "kind" | "review" | "sort">;

const KIND_OPTIONS: { value: StoreKind | "all"; label: string }[] = [
  { value: "all", label: "Todas" },
  ...storeKindSchema.options.map((k) => ({ value: k, label: STORE_KIND_LABEL[k] })),
];

/** Ordens oferecidas (a tabela também ordena clicando no cabeçalho). */
export const SORT_OPTIONS: { value: CouponSort; label: string }[] = [
  { value: "-created", label: "Criadas por último" },
  { value: "-starts", label: "Começam por último" },
  { value: "starts", label: "Começam primeiro" },
  { value: "ends", label: "Terminam primeiro" },
  { value: "-used", label: "Mais usadas" },
  { value: "remaining", label: "Menos restantes" },
  { value: "title", label: "Nome (A–Z)" },
];

/**
 * Busca e filtros das promoções (o estado mora na URL). Lojista não vê filtro
 * de loja. Na fila "Aprovar cupons" (`reviewing`), só busca e loja.
 */
export function CouponFilters({
  search,
  onSearch,
  filters,
  onChange,
  merchant,
  reviewing = false,
}: {
  search: string;
  onSearch: (value: string) => void;
  filters: Filters;
  onChange: (patch: Partial<Record<keyof Filters, string | undefined>>) => void;
  merchant: boolean;
  reviewing?: boolean;
}) {
  const stores = useStoreOptions({ enabled: !merchant });
  const storeOptions = useMemo(
    () =>
      storeComboboxOptions(
        (stores.data ?? []).filter((s) => !filters.kind || s.kind === filters.kind),
      ),
    [stores.data, filters.kind],
  );
  const active = reviewing
    ? Boolean(search || filters.storeId)
    : Boolean(search || filters.storeId || filters.lifecycle || filters.kind || filters.review);

  return (
    <FilterBar className="mb-5">
      <SearchInput
        value={search}
        onChange={onSearch}
        placeholder="Buscar promoção"
        label="Buscar promoção"
        className="w-full sm:w-64"
      />
      {!merchant && (
        <>
          {!reviewing && (
            <Segmented
              label="Tipo de loja"
              size="sm"
              options={KIND_OPTIONS}
              value={filters.kind ?? "all"}
              onChange={(v) => onChange({ kind: v === "all" ? undefined : v, storeId: undefined })}
            />
          )}
          <Combobox
            aria-label="Loja"
            placeholder="Todas as lojas"
            emptyText="Nenhuma loja com esse nome"
            options={storeOptions}
            loading={stores.isLoading}
            value={filters.storeId ?? null}
            onChange={(v) => onChange({ storeId: v ?? undefined })}
            className="w-full sm:w-56"
          />
        </>
      )}
      {!reviewing && (
        <>
          <Select
            aria-label="Situação"
            placeholder="Todas as situações"
            value={filters.lifecycle ?? ""}
            onChange={(e) => onChange({ lifecycle: e.target.value || undefined })}
            className="w-full sm:w-52"
          >
            {LIFECYCLE_ORDER.map((s) => (
              <option key={s} value={s}>
                {COUPON_LIFECYCLE[s].plural}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Revisão da ARP"
            placeholder="Qualquer revisão"
            value={filters.review ?? ""}
            onChange={(e) =>
              onChange({ review: (e.target.value || undefined) as Filters["review"] })
            }
            className="w-full sm:w-44"
          >
            {couponReviewSchema.options.map((r) => (
              <option key={r} value={r}>
                {COUPON_REVIEW_LABEL[r]}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Ordenar"
            value={filters.sort ?? "-created"}
            onChange={(e) =>
              onChange({ sort: e.target.value === "-created" ? undefined : e.target.value })
            }
            className="w-full sm:w-48"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
            {/* Ordem escolhida no cabeçalho da tabela que não está na lista acima. */}
            {filters.sort && !SORT_OPTIONS.some((o) => o.value === filters.sort) && (
              <option value={filters.sort}>Ordem da tabela</option>
            )}
          </Select>
        </>
      )}
      {active && (
        <Button
          variant="ghost"
          size="sm"
          icon={FilterX}
          onClick={() => {
            onSearch("");
            onChange(
              reviewing
                ? { storeId: undefined }
                : { storeId: undefined, lifecycle: undefined, kind: undefined, review: undefined },
            );
          }}
        >
          Limpar filtros
        </Button>
      )}
    </FilterBar>
  );
}
